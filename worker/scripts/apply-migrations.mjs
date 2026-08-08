// Applies worker/migrations/*.sql to Neon in filename order, once each.
// Node-only: uses `pg` (not the Workers driver) so multi-statement SQL files
// with $$-quoted function bodies run as-is.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

function loadDevVars() {
  try {
    const raw = readFileSync(join(here, '..', '.dev.vars'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // .dev.vars is optional when the environment already provides DATABASE_URL.
  }
}

loadDevVars();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (worker/.dev.vars or environment).');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  );
`);

const { rows } = await client.query('SELECT name FROM schema_migrations');
const applied = new Set(rows.map((r) => r.name));

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
let count = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`· ${file} (already applied)`);
    continue;
  }

  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`✓ ${file}`);
    count += 1;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✗ ${file}\n  ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(count === 0 ? 'Schema already up to date.' : `Applied ${count} migration(s).`);
await client.end();
