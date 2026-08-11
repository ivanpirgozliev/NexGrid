import { Hono } from 'hono';
import { getDb, isUniqueViolation, type Db } from '../db';
import { avatarKey } from '../lib/avatars';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
} from '../lib/tokens';
import {
  normalizeEmail,
  validatePassword,
  validateUsername,
} from '../lib/validation';
import { requireAuth } from '../middleware/auth';
import type { AppBindings, Env } from '../types';

const BCRYPT_COST = 10;
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;

/*
  Burned when sign-in is attempted against an address that has no account, so
  the response time does not reveal whether an email is registered. The value is
  a throwaway bcrypt hash; only the cost of computing against it matters.
*/
const TIMING_DECOY_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

async function issueSession(db: Db, env: Env, user: SessionUser) {
  const { token: accessToken, expiresAt } = await createAccessToken(
    { id: user.id, email: user.email },
    env.JWT_SECRET
  );

  const refreshToken = createRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);
  const refreshExpiry = new Date(
    Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000
  ).toISOString();

  await db`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${user.id}, ${refreshHash}, ${refreshExpiry})
  `;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  };
}

export const authRoutes = new Hono<AppBindings>();

authRoutes.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { email: rawEmail, password, username: rawUsername } = body as Record<
    string,
    unknown
  >;

  const email = normalizeEmail(rawEmail);
  if (!email) return c.json({ error: 'Enter a valid email address' }, 400);

  const passwordError = validatePassword(password);
  if (passwordError) return c.json({ error: passwordError }, 400);

  // Matches the old Supabase trigger, which fell back to the email local part.
  const username =
    typeof rawUsername === 'string' && rawUsername.trim().length > 0
      ? rawUsername.trim()
      : email.split('@')[0];

  const usernameError = validateUsername(username);
  if (usernameError) return c.json({ error: usernameError }, 400);

  const db = getDb(c.env);

  try {
    /*
      One statement so the user and profile are created together: a
      data-modifying CTE always runs, even though nothing selects from it, and
      the whole statement is a single implicit transaction. This replaces the
      Supabase `on_auth_user_created` trigger.
    */
    const rows = (await db`
      WITH new_user AS (
        INSERT INTO users (email, password_hash)
        VALUES (${email}, crypt(${password as string}, gen_salt('bf', ${BCRYPT_COST})))
        RETURNING id, email, created_at
      ), new_profile AS (
        INSERT INTO profiles (id, username)
        SELECT id, ${username} FROM new_user
        RETURNING id, username, avatar_url
      )
      SELECT u.id, u.email, u.created_at, p.username, p.avatar_url
      FROM new_user u JOIN new_profile p ON p.id = u.id
    `) as SessionUser[];

    return c.json(await issueSession(db, c.env, rows[0]), 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return c.json({ error: 'That email is already registered' }, 409);
    }
    throw err;
  }
});

authRoutes.post('/signin', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { email: rawEmail, password } = body as Record<string, unknown>;
  const email = normalizeEmail(rawEmail);

  if (!email || typeof password !== 'string' || password.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const db = getDb(c.env);

  const rows = (await db`
    SELECT
      u.id,
      u.email,
      u.created_at,
      u.locked_until,
      p.username,
      p.avatar_url,
      u.password_hash = crypt(${password}, u.password_hash) AS valid
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.email = ${email}
  `) as Array<SessionUser & { locked_until: string | null; valid: boolean }>;

  const account = rows[0];

  if (!account) {
    await db`SELECT crypt(${password}, ${TIMING_DECOY_HASH})`;
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    return c.json(
      { error: 'Too many failed attempts. Try again shortly.' },
      429
    );
  }

  if (!account.valid) {
    /*
      Count the failure and lock once the threshold is crossed. The lock is
      time-boxed and clears itself, so it slows guessing without handing anyone
      a way to permanently lock an account they know the address of.
    */
    await db`
      UPDATE users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= ${MAX_FAILED_LOGINS}
            THEN now() + (${LOCKOUT_MINUTES} || ' minutes')::interval
            ELSE locked_until
          END,
          updated_at = now()
      WHERE id = ${account.id}
    `;
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  await db`
    UPDATE users
    SET failed_login_count = 0, locked_until = NULL, updated_at = now()
    WHERE id = ${account.id} AND (failed_login_count <> 0 OR locked_until IS NOT NULL)
  `;

  return c.json(await issueSession(db, c.env, account));
});

authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null);
  const refreshToken = (body as Record<string, unknown> | null)?.refresh_token;

  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return c.json({ error: 'Missing refresh token' }, 400);
  }

  const db = getDb(c.env);
  const tokenHash = await hashRefreshToken(refreshToken);

  /*
    Rotation: revoking and reading the row in one UPDATE ... RETURNING makes the
    token strictly single-use. A replayed token matches no unrevoked row and
    comes back empty, even if two requests race.
  */
  const revoked = (await db`
    UPDATE refresh_tokens
    SET revoked_at = now()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > now()
    RETURNING user_id
  `) as Array<{ user_id: string }>;

  if (revoked.length === 0) {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  const users = (await db`
    SELECT u.id, u.email, u.created_at, p.username, p.avatar_url
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = ${revoked[0].user_id}
  `) as SessionUser[];

  if (users.length === 0) {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  // Opportunistic housekeeping; keeps the table from growing without a cron.
  await db`
    DELETE FROM refresh_tokens
    WHERE user_id = ${users[0].id}
      AND (expires_at < now() OR revoked_at < now() - interval '1 day')
  `;

  return c.json(await issueSession(db, c.env, users[0]));
});

authRoutes.post('/signout', async (c) => {
  const body = await c.req.json().catch(() => null);
  const refreshToken = (body as Record<string, unknown> | null)?.refresh_token;

  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    const db = getDb(c.env);
    await db`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = ${await hashRefreshToken(refreshToken)}
        AND revoked_at IS NULL
    `;
  }

  // Always 204: signing out must not report whether the token was still live.
  return c.body(null, 204);
});

/*
  Self-service account deletion, which the privacy policy promises.

  The password is required even though the caller already holds a valid access
  token: this is irreversible, and a stolen token alone should not be enough to
  destroy someone's account.

  The avatar is removed from R2 before the database row. Doing it the other way
  round risks leaving an image of a deleted user in public storage if the second
  step fails — a retention problem — whereas this order at worst loses an avatar
  for an account that still exists, which the user can simply re-upload.

  Everything else goes with the user row: profiles, scores, game_sessions and
  refresh_tokens all cascade.
*/
authRoutes.delete('/account', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const password = (body as Record<string, unknown> | null)?.password;

  if (typeof password !== 'string' || password.length === 0) {
    return c.json({ error: 'Password confirmation is required' }, 400);
  }

  const db = getDb(c.env);
  const user = c.get('user');

  const confirmed = (await db`
    SELECT id FROM users
    WHERE id = ${user.id}
      AND password_hash = crypt(${password}, password_hash)
  `) as Array<{ id: string }>;

  if (confirmed.length === 0) {
    return c.json({ error: 'Incorrect password' }, 401);
  }

  await c.env.AVATARS.delete(avatarKey(user.id));
  await db`DELETE FROM users WHERE id = ${user.id}`;

  console.info(`Account deleted: ${user.id}`);
  return c.body(null, 204);
});

authRoutes.get('/me', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  const rows = (await db`
    SELECT u.id, u.email, u.created_at, p.username, p.avatar_url
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = ${user.id}
  `) as SessionUser[];

  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);

  return c.json(rows[0]);
});
