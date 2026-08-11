# Security Threat Model

## Scope

Score integrity, account safety and abuse resistance for:

- The Cloudflare Worker API (`nexgrid-api`) — every route under `/auth`, `/game`, `/leaderboard`, `/scores`, `/stats`, `/profile`, `/presence`
- Neon Postgres: `users`, `refresh_tokens`, `profiles`, `game_sessions`, `scores`
- The R2 bucket `nexgrid`, which serves avatars over a public URL
- The Electron desktop client

## What changed from the Supabase design

The previous system let the browser talk to PostgREST directly and relied on
**Row Level Security** to decide what each caller could read or write. There is
no RLS now, and no client-reachable database.

This is the single most important fact about the current model: **authorization
is application logic in the Worker, not a database guarantee.** Under RLS, a
missing `WHERE user_id = auth.uid()` was caught by Postgres. Today the same
omission is a data leak. Postgres still enforces the rules that must hold no
matter what the code does — value ranges, uniqueness, referential integrity —
but it no longer decides *who* may see a row.

## Assets to Protect

- Leaderboard integrity (no forged or replayed scores)
- Session ownership — a player may submit only their own game
- Password hashes and the ability to authenticate as another user
- `DATABASE_URL` and `JWT_SECRET`, which are Worker secrets and never shipped
- Avatar objects in R2

## Trust Boundaries

- **The client is untrusted.** It ships as an Electron app, so its bundle,
  its localStorage and all its traffic are fully inspectable by its user. It
  holds no credential beyond the tokens of the account already signed in.
- **The Worker is the trusted compute boundary.** It is the only thing holding a
  database connection string or an R2 binding.
- **Database constraints and triggers are the final integrity boundary** for
  score plausibility, and hold even if the Worker is wrong.

## Primary Threats

1. Writing scores without playing (direct API calls)
2. Replaying a previously valid game session
3. Forging a `session_id` / token pair
4. Implausible score payloads — impossible score, lines, level or timing
5. Reading another player's scores, stats or profile
6. Password guessing against the sign-in endpoint
7. Stealing or replaying tokens
8. Abusing avatar upload to store or serve hostile content
9. Cross-origin abuse from a hostile web page

## Implemented Controls

### API boundary

- Every data and game route requires a valid HS256 access token; the algorithm
  is pinned, so a forged header cannot select another one.
- The subject is read from the token, never from the request body. There is no
  endpoint that accepts a caller-supplied user id.
- CORS allowlist for browser origins. A request with no `Origin` is allowed
  because the packaged desktop client sends none; this is not a CSRF hole,
  since the API authenticates with a bearer token from localStorage and never
  with an ambient cookie.
- Internal errors are logged in full but answered with a generic message, so
  Postgres errors do not leak schema details.

### Authentication

- Passwords are hashed with bcrypt (cost 10) by pgcrypto inside Postgres.
  Hashing runs there rather than in the Worker because Cloudflare's free plan
  caps a request at 10 ms of CPU, and time spent waiting on the database is I/O
  rather than CPU.
- Sign-in against an unknown address still performs a bcrypt round against a
  decoy hash, so response time does not reveal whether an email is registered.
  Unknown-address and wrong-password answers are byte-identical.
- Ten consecutive failures lock an account for 15 minutes. The lock is
  deliberately short and self-clearing: a permanent lock would let anyone who
  knows an email address deny that user access.
- Access tokens live one hour. Refresh tokens live 30 days, are stored only as
  SHA-256 digests, and are single-use — rotation is a single
  `UPDATE … RETURNING`, so a replayed token matches no unrevoked row even under
  a race.

### Session and score integrity

- `/game/start` issues a 256-bit server-generated session token, never derived
  from client input.
- Concurrent sessions per user are capped, with the expiry sweep, the count and
  the insert in one statement so two rapid requests cannot both see room.
- `/game/submit-score` validates session ownership, token match, session age
  bounds, play time against lines cleared, heartbeat count and freshness,
  score against the theoretical `[min, max]` for the lines claimed, level
  consistency, and a per-user rate limit.
- All durations are computed by Postgres from its own timestamps, so the checks
  do not depend on the client's clock or on skew between Worker and database.
- Heartbeat counting is a single atomic `UPDATE` with the minimum interval in
  the `WHERE` clause, so the count cannot be inflated by parallel requests.
- The session is claimed before insert, making replay ineffective.

### Storage

- Avatar uploads are capped at 2 MB and restricted to JPEG, PNG and WebP.
- The declared `Content-Type` is checked against the file's leading bytes.
  This matters because R2 later serves the object with the type we record, so
  a mislabelled file would be served under a type it is not.
- The object key is derived from the token subject, so no caller can write to
  another user's avatar path.

### Database integrity

- `CHECK` constraints bound score, level and lines.
- `scores.session_id` is `NOT NULL` and uniquely indexed — one score per
  session, enforced by storage rather than by code.
- A `BEFORE INSERT` trigger rejects any score whose session is missing, owned by
  a different user, or not yet completed.

## Residual Risks

- **Authorization has no backstop.** A query in the Worker that forgets to
  filter by the token subject will leak data, where RLS would previously have
  stopped it. Every new data route needs that filter, and a test proving another
  user cannot read the same rows.
- **Tokens sit in localStorage.** Any code executing in the renderer can read
  them. Node integration is off and the app loads no remote content, which is
  what keeps that surface small — both properties must stay true.
- Sophisticated botting can still imitate plausible timing and heartbeat
  patterns; the controls raise the cost, not an absolute barrier.
- The avatar bucket is served through the rate-limited `r2.dev` development
  domain, which Cloudflare does not recommend for production traffic.
- Shared-account abuse is out of scope.
- If the CORS allowlist is not updated when origins change, legitimate clients
  are blocked.

## Operational Checklist

1. Never expose `DATABASE_URL` or `JWT_SECRET` outside Worker secrets. Neither
   may appear in the client bundle, in `wrangler.toml`, or in git.
2. When adding a data route, filter by the token subject and add a test that a
   second user cannot read the first user's rows.
3. Keep `ALLOWED_ORIGINS` current when origins change.
4. Rotate `JWT_SECRET` if exposure is suspected — this invalidates all access
   tokens; refresh tokens survive, since they are opaque and stored hashed.
5. Watch score distributions for anomalies.

## Incident Response (score abuse)

1. Tighten or disable the affected route and redeploy — `wrangler deploy`
   propagates in seconds.
2. Identify the pattern: burst inserts, impossible score-to-time ratios,
   sessions with too few heartbeats.
3. Delete the offending `scores` rows by `session_id`.
4. Add the case as a test against the deployed API before patching, so the fix
   is demonstrated rather than assumed.
5. Redeploy and re-run the full suite.

## Incident Response (credential compromise)

1. Rotate `JWT_SECRET` to invalidate every outstanding access token.
2. `DELETE FROM refresh_tokens WHERE user_id = …` to end that user's sessions.
3. If the database itself is suspected, rotate the Neon password and update the
   Worker secret; the connection string exists in exactly those two places.
