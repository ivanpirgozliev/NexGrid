import { Hono } from 'hono';
import { getDb } from '../db';
import {
  MAX_LEVEL_POSSIBLE,
  MAX_LINES_POSSIBLE,
  computeScoreBounds,
} from '../lib/scoring';
import { isUuid } from '../lib/validation';
import { requireAuth } from '../middleware/auth';
import type { AppBindings } from '../types';

/*
  Anti-cheat thresholds, carried over unchanged from the Supabase edge
  functions. Changing any of these changes what counts as a plausible game.
*/
const MAX_ACTIVE_SESSIONS = 3;
const SESSION_EXPIRY_HOURS = 2;
const MIN_HEARTBEAT_INTERVAL_SECONDS = 8;
const RATE_LIMIT_SECONDS = 5;
const MIN_SECONDS_PER_LINE = 1.5;
const MIN_SESSION_SECONDS = 10;
const MAX_SESSION_SECONDS = 2 * 60 * 60;
const HEARTBEAT_INTERVAL_SECONDS = 15;
const HEARTBEAT_GRACE_SECONDS = 5;
const MAX_HEARTBEAT_STALENESS_SECONDS = 45;

const SESSION_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const gameRoutes = new Hono<AppBindings>();

gameRoutes.use('*', requireAuth);

gameRoutes.post('/start', async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const token = generateSessionToken();

  /*
    Expiring stale sessions, counting the live ones and inserting the new one
    happen in a single statement, so two rapid requests cannot both observe
    "2 active" and push the user to 4. The count deliberately repeats the age
    filter from the DELETE: CTEs run against one snapshot, so the rows being
    deleted are still visible to the count.
  */
  const rows = (await db`
    WITH expired AS (
      DELETE FROM game_sessions
      WHERE user_id = ${user.id}
        AND completed = false
        AND started_at < now() - ${`${SESSION_EXPIRY_HOURS} hours`}::interval
    ), active AS (
      SELECT count(*) AS n
      FROM game_sessions
      WHERE user_id = ${user.id}
        AND completed = false
        AND started_at >= now() - ${`${SESSION_EXPIRY_HOURS} hours`}::interval
    )
    INSERT INTO game_sessions (user_id, token)
    SELECT ${user.id}, ${token}
    FROM active
    WHERE n < ${MAX_ACTIVE_SESSIONS}
    RETURNING id, started_at, token
  `) as Array<{ id: string; started_at: string; token: string }>;

  if (rows.length === 0) {
    console.warn(`Too many active sessions for user ${user.id}`);
    return c.json({ error: 'Too many active sessions' }, 429);
  }

  console.info(`Game session started for user ${user.id}: ${rows[0].id}`);
  return c.json(rows[0]);
});

gameRoutes.post('/heartbeat', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { session_id, token } = body as Record<string, unknown>;

  if (
    !isUuid(session_id) ||
    typeof token !== 'string' ||
    !SESSION_TOKEN_REGEX.test(token)
  ) {
    return c.json({ error: 'Missing session_id or token' }, 400);
  }

  const db = getDb(c.env);
  const user = c.get('user');

  /*
    The counter is incremented in the database rather than read-then-written by
    the Worker. The edge function computed `heartbeat_count + 1` in JS, so two
    concurrent heartbeats could both read N and both write N+1; here the minimum
    interval is part of the WHERE clause and the increment is atomic, which
    means the count cannot be inflated by firing heartbeats in parallel.
  */
  const updated = (await db`
    UPDATE game_sessions
    SET heartbeat_count = heartbeat_count + 1,
        last_heartbeat_at = now()
    WHERE id = ${session_id}
      AND user_id = ${user.id}
      AND token = ${token}
      AND completed = false
      AND (
        last_heartbeat_at IS NULL
          AND started_at <= now() - ${`${MIN_HEARTBEAT_INTERVAL_SECONDS} seconds`}::interval
        OR last_heartbeat_at <= now() - ${`${MIN_HEARTBEAT_INTERVAL_SECONDS} seconds`}::interval
      )
    RETURNING id
  `) as Array<{ id: string }>;

  if (updated.length > 0) {
    return c.json({ ok: true });
  }

  // Nothing was updated: either the session is not usable, or the heartbeat
  // simply arrived too early, which the edge function also answered with 200.
  const sessions = (await db`
    SELECT token
    FROM game_sessions
    WHERE id = ${session_id} AND user_id = ${user.id} AND completed = false
  `) as Array<{ token: string }>;

  if (sessions.length === 0) {
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (sessions[0].token !== token) {
    console.warn(`Token mismatch for session ${session_id} from user ${user.id}`);
    return c.json({ error: 'Invalid token' }, 403);
  }

  return c.json({ ok: true });
});

gameRoutes.post('/submit-score', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { score, level, lines, session_id, token } = body as Record<
    string,
    unknown
  >;
  const db = getDb(c.env);
  const user = c.get('user');

  if (
    typeof score !== 'number' ||
    typeof level !== 'number' ||
    typeof lines !== 'number' ||
    !Number.isInteger(score) ||
    !Number.isInteger(level) ||
    !Number.isInteger(lines) ||
    score < 0 ||
    level < 1 ||
    lines < 0 ||
    level > MAX_LEVEL_POSSIBLE ||
    lines > MAX_LINES_POSSIBLE
  ) {
    console.warn(
      `Invalid score data from user ${user.id}: score=${score}, level=${level}, lines=${lines}`
    );
    return c.json({ error: 'Invalid score data' }, 400);
  }

  const expectedLevel = Math.floor(lines / 10) + 1;
  if (level > expectedLevel) {
    console.warn(
      `Level mismatch from user ${user.id}: level=${level}, expected=${expectedLevel}`
    );
    return c.json({ error: 'Invalid score data' }, 400);
  }

  const { min: minScore, max: maxScore } = computeScoreBounds(lines);
  if (score > maxScore || (lines > 0 && score < minScore)) {
    console.warn(
      `Score outside bounds from user ${user.id}: score=${score}, range=${minScore}-${maxScore}, lines=${lines}`
    );
    return c.json({ error: 'Invalid score data' }, 400);
  }

  if (!isUuid(session_id)) {
    console.warn(`Missing game session from user ${user.id}`);
    return c.json({ error: 'Game session required' }, 400);
  }

  if (typeof token !== 'string' || !SESSION_TOKEN_REGEX.test(token)) {
    console.warn(`Missing token from user ${user.id}`);
    return c.json({ error: 'Token required' }, 400);
  }

  /*
    All the timing facts are derived by Postgres in one round trip. The edge
    function compared `Date.now()` against database timestamps, which made every
    duration check sensitive to clock skew between the two; computing the ages
    where the timestamps were written removes that.
  */
  const sessions = (await db`
    SELECT
      gs.token,
      gs.heartbeat_count,
      extract(epoch FROM (now() - gs.started_at)) AS session_age,
      CASE
        WHEN gs.last_heartbeat_at IS NULL THEN NULL
        ELSE extract(epoch FROM (now() - gs.last_heartbeat_at))
      END AS heartbeat_age,
      (
        SELECT extract(epoch FROM (now() - max(s.created_at)))
        FROM scores s
        WHERE s.user_id = gs.user_id
      ) AS last_score_age
    FROM game_sessions gs
    WHERE gs.id = ${session_id}
      AND gs.user_id = ${user.id}
      AND gs.completed = false
  `) as Array<{
    token: string;
    heartbeat_count: number;
    session_age: number;
    heartbeat_age: number | null;
    last_score_age: number | null;
  }>;

  const session = sessions[0];

  if (!session || !session.token) {
    console.warn(
      `Invalid game session from user ${user.id}: session_id=${session_id}`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (session.token !== token) {
    console.warn(`Token mismatch from user ${user.id}: session_id=${session_id}`);
    return c.json({ error: 'Invalid token' }, 403);
  }

  const sessionAge = Number(session.session_age);

  if (sessionAge < MIN_SESSION_SECONDS) {
    console.warn(`Session too short from user ${user.id}: ${sessionAge}s`);
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (sessionAge > MAX_SESSION_SECONDS) {
    console.warn(`Session too long from user ${user.id}: ${sessionAge}s`);
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (lines > 0 && sessionAge < lines * MIN_SECONDS_PER_LINE) {
    console.warn(
      `Suspiciously fast game from user ${user.id}: ${sessionAge}s for ${lines} lines`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (lines > Math.floor(sessionAge / MIN_SECONDS_PER_LINE)) {
    console.warn(
      `Too many lines for session duration from user ${user.id}: ${lines} in ${sessionAge}s`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  const expectedHeartbeats = Math.max(
    0,
    Math.floor((sessionAge - HEARTBEAT_GRACE_SECONDS) / HEARTBEAT_INTERVAL_SECONDS)
  );
  const heartbeats = session.heartbeat_count ?? 0;

  if (expectedHeartbeats > 0 && heartbeats < Math.ceil(expectedHeartbeats * 0.5)) {
    console.warn(
      `Insufficient heartbeats from user ${user.id}: got ${heartbeats}, expected ~${expectedHeartbeats}`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (session.heartbeat_age !== null) {
    if (Number(session.heartbeat_age) > MAX_HEARTBEAT_STALENESS_SECONDS) {
      console.warn(
        `Stale heartbeat from user ${user.id}: ${session.heartbeat_age}s`
      );
      return c.json({ error: 'Invalid game session' }, 400);
    }
  } else if (expectedHeartbeats > 0) {
    console.warn(
      `Missing heartbeat timestamp from user ${user.id} for ${sessionAge}s session`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  if (
    session.last_score_age !== null &&
    Number(session.last_score_age) < RATE_LIMIT_SECONDS
  ) {
    console.warn(
      `Rate limited user ${user.id}: ${session.last_score_age}s since last score`
    );
    return c.json({ error: 'Too many requests' }, 429);
  }

  /*
    Claiming the session and inserting the score stay two statements: the
    BEFORE INSERT trigger on `scores` re-reads game_sessions.completed, and a
    data-modifying CTE would not be visible to it within one statement.
  */
  const claimed = (await db`
    UPDATE game_sessions
    SET completed = true
    WHERE id = ${session_id}
      AND user_id = ${user.id}
      AND token = ${token}
      AND completed = false
    RETURNING id
  `) as Array<{ id: string }>;

  if (claimed.length === 0) {
    console.warn(
      `Replay or already completed session for user ${user.id}: session_id=${session_id}`
    );
    return c.json({ error: 'Invalid game session' }, 400);
  }

  const inserted = (await db`
    INSERT INTO scores (user_id, session_id, score, level, lines)
    VALUES (${user.id}, ${session_id}, ${score}, ${level}, ${lines})
    RETURNING id, user_id, session_id, score, level, lines, created_at
  `) as Array<Record<string, unknown>>;

  console.info(
    `Score saved for user ${user.id}: score=${score}, level=${level}, lines=${lines}, duration=${sessionAge}s`
  );
  return c.json(inserted[0]);
});
