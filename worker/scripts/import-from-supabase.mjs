/*
  One-off import of the Supabase project into Neon.

  Reads both connection strings from worker/.dev.vars (gitignored) or the
  environment. Idempotent: every insert is an upsert keyed on the original id,
  so a re-run repairs a partial import rather than duplicating rows.

  Avatars are not handled here. The image bytes live in Supabase Storage, and
  copying them needs the R2 binding, which only the deployed Worker holds — see
  POST /admin/import-avatar. `avatar_url` is therefore left NULL and set when
  the object actually lands in R2, so it never points at a missing file.

  Run with --apply to write; without it the script only reports what it would do.
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

function loadDevVars() {
  try {
    const raw = readFileSync(join(here, '..', '.dev.vars'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Optional when the environment already carries both URLs.
  }
}

loadDevVars();

const { SUPABASE_DB_URL, DATABASE_URL } = process.env;

if (!SUPABASE_DB_URL || !DATABASE_URL) {
  console.error('Both SUPABASE_DB_URL and DATABASE_URL must be set.');
  process.exit(1);
}

const source = new pg.Client({
  connectionString: SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
const target = new pg.Client({ connectionString: DATABASE_URL });

await source.connect();
await target.connect();

// ── read ────────────────────────────────────────────────────────────────────
const { rows: users } = await source.query(`
  SELECT u.id, lower(u.email) AS email, u.encrypted_password, u.created_at,
         p.username, p.last_seen_at, p.created_at AS profile_created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at
`);

/*
  pgcrypto's crypt() understands $2a$ but returns a non-match for $2b$ without
  raising, so an unnoticed $2b$ hash would present as "wrong password" forever.
  Refuse to import rather than let that reach a user.

  If this ever fires: $2a$ and $2b$ are the same algorithm below 72 bytes, so
  rewriting the prefix is a valid fix — but make that an explicit decision.
*/
const badHashes = users.filter((u) => !u.encrypted_password?.startsWith('$2a$'));
if (badHashes.length > 0) {
  console.error('Refusing to import: password hashes that pgcrypto cannot verify.');
  for (const u of badHashes) {
    console.error(`  ${u.email}: ${u.encrypted_password?.slice(0, 4) ?? 'NULL'}`);
  }
  process.exit(1);
}

const emails = users.map((u) => u.email);
if (new Set(emails).size !== emails.length) {
  console.error('Refusing to import: two accounts collide once emails are lowercased.');
  process.exit(1);
}

/*
  Only scores that carry a session are imported, per the decision to keep
  scores.session_id NOT NULL. The Supabase schema had grandfathered its older
  rows behind a NOT VALID constraint; those are dropped here.
*/
const { rows: droppedScores } = await source.query(`
  SELECT count(*)::int AS n, coalesce(max(score), 0) AS best
  FROM public.scores WHERE session_id IS NULL
`);

const { rows: scores } = await source.query(`
  SELECT id, user_id, session_id, score, level, lines, created_at
  FROM public.scores
  WHERE session_id IS NOT NULL
  ORDER BY created_at
`);

// Only the sessions those scores point at; the rest is stale operational data.
const { rows: sessions } = await source.query(`
  SELECT gs.id, gs.user_id, gs.token, gs.started_at, gs.completed,
         gs.heartbeat_count, gs.last_heartbeat_at
  FROM public.game_sessions gs
  WHERE gs.id IN (SELECT session_id FROM public.scores WHERE session_id IS NOT NULL)
`);

// The trigger on scores rejects a link to a session that is not completed.
const notCompleted = sessions.filter((s) => s.completed !== true);
if (notCompleted.length > 0) {
  console.error(
    `Refusing to import: ${notCompleted.length} referenced session(s) are not completed; ` +
      'the scores trigger would reject their score rows.'
  );
  process.exit(1);
}

console.log('PLAN');
console.log(`  users           ${users.length}`);
console.log(`  profiles        ${users.filter((u) => u.username !== null).length}`);
console.log(`  game_sessions   ${sessions.length}`);
console.log(`  scores          ${scores.length}`);
console.log(
  `  scores dropped  ${droppedScores[0].n} (no session_id; best among them: ${droppedScores[0].best})`
);
console.log(`  avatars         handled separately via /admin/import-avatar`);

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to import.');
  await source.end();
  await target.end();
  process.exit(0);
}

// ── write ───────────────────────────────────────────────────────────────────
try {
  await target.query('BEGIN');

  for (const u of users) {
    await target.query(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      [u.id, u.email, u.encrypted_password, u.created_at]
    );

    await target.query(
      `INSERT INTO profiles (id, username, last_seen_at, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET username = EXCLUDED.username, last_seen_at = EXCLUDED.last_seen_at`,
      [
        u.id,
        u.username ?? u.email.split('@')[0],
        u.last_seen_at,
        u.profile_created_at ?? u.created_at,
      ]
    );
  }

  for (const s of sessions) {
    await target.query(
      `INSERT INTO game_sessions
         (id, user_id, token, started_at, completed, heartbeat_count, last_heartbeat_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.user_id, s.token ?? '', s.started_at, s.completed, s.heartbeat_count ?? 0, s.last_heartbeat_at]
    );
  }

  for (const s of scores) {
    await target.query(
      `INSERT INTO scores (id, user_id, session_id, score, level, lines, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.user_id, s.session_id, s.score, s.level, s.lines, s.created_at]
    );
  }

  await target.query('COMMIT');
} catch (err) {
  await target.query('ROLLBACK');
  console.error('\nImport failed and was rolled back:', err.message);
  await source.end();
  await target.end();
  process.exit(1);
}

const { rows: verify } = await target.query(`
  SELECT
    (SELECT count(*)::int FROM users)         AS users,
    (SELECT count(*)::int FROM profiles)      AS profiles,
    (SELECT count(*)::int FROM game_sessions) AS sessions,
    (SELECT count(*)::int FROM scores)        AS scores
`);

console.log('\nIMPORTED');
console.table(verify[0]);

await source.end();
await target.end();
