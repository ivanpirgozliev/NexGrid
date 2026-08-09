import { Hono } from 'hono';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';
import type { AppBindings } from '../types';

/*
  Every route here needs a signed-in caller, matching the Supabase grants these
  replace: the `leaderboard` view and both stats functions were granted to
  `authenticated` only, never to `anon`.

  Two of them are deliberately narrower than what they replace. `get_user_stats`
  took a user id argument, so any signed-in user could ask for anyone's numbers,
  and the scores RLS policy allowed reading every row. The client only ever
  asked about the current user, so these read the caller's id from the token and
  ignore any id in the request.
*/
/*
  `requireAuth` is attached per route rather than as a `use('*')` guard: this
  router is mounted at the root, so a catch-all here would also sit in front of
  /auth/signin and /health.
*/
export const dataRoutes = new Hono<AppBindings>();

dataRoutes.get('/leaderboard', requireAuth, async (c) => {
  const db = getDb(c.env);
  // The view carries its own ORDER BY score DESC and LIMIT 100.
  const rows = await db`SELECT * FROM leaderboard`;
  return c.json(rows);
});

dataRoutes.get('/scores/me', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  const rows = await db`
    SELECT id, user_id, score, level, lines, created_at
    FROM scores
    WHERE user_id = ${user.id}
    ORDER BY score DESC
    LIMIT 10
  `;

  return c.json(rows);
});

dataRoutes.get('/stats/me', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  const rows = (await db`SELECT get_user_stats(${user.id}) AS stats`) as Array<{
    stats: { games_played: number; avg_score: number; best_streak: number };
  }>;

  return c.json(rows[0].stats);
});

dataRoutes.get('/stats/public', requireAuth, async (c) => {
  const db = getDb(c.env);

  const rows = (await db`SELECT get_public_game_stats() AS stats`) as Array<{
    stats: { total_users: number; online_users: number };
  }>;

  return c.json(rows[0].stats);
});

dataRoutes.get('/profile/me', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  const rows = await db`
    SELECT id, username, avatar_url, created_at
    FROM profiles
    WHERE id = ${user.id}
  `;

  if (rows.length === 0) return c.json({ error: 'Profile not found' }, 404);

  return c.json(rows[0]);
});

/*
  Presence heartbeat. The client previously wrote `last_seen_at` straight into
  `profiles` through PostgREST, with RLS confining the write to the caller's own
  row; here the row is chosen by the token's subject instead, so the client has
  no say in which profile it touches.
*/
dataRoutes.post('/presence', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  await db`UPDATE profiles SET last_seen_at = now() WHERE id = ${user.id}`;

  return c.body(null, 204);
});
