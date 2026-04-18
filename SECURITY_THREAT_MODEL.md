# Security Threat Model

## Scope

This document covers score integrity and abuse resistance for:

- Supabase Edge Functions: start-game, game-heartbeat, submit-score
- Public database objects: profiles, scores, leaderboard, game_sessions
- Browser client interactions through Supabase Auth and Edge endpoints

## Assets to Protect

- Leaderboard integrity (no forged top scores)
- Fair player progression metrics
- Session ownership (a player can submit only their own game)
- Service role key safety (never exposed to browser)

## Trust Boundaries

- Browser is untrusted
- Supabase Auth JWT verification is trusted when verify_jwt is enabled
- Edge Functions are trusted compute boundary
- Database constraints/triggers are final integrity boundary

## Primary Threats

1. Direct insert/update attempts to scores from browser tools
2. Replay of a previously valid game session
3. Forged session_id/token combinations
4. Suspicious score payloads (impossible score/lines/level/time)
5. Cross-origin abuse from unauthorized websites
6. Privilege creep from overly broad DB grants

## Implemented Controls

### Gateway + API Boundary

- Edge functions are deployed with verify_jwt=true.
- Function endpoints require Authorization bearer tokens.
- Function-level CORS allowlist:
  - Local dev: localhost/127.0.0.1 ports 5173/5174
  - Production: https://sb1-wmjgmeyv.bolt.new
  - Optional extension via ALLOWED_ORIGINS (comma-separated)

### Session and Score Integrity

- start-game issues server-generated cryptographic token per session.
- submit-score validates:
  - UUID shape for session_id and fixed token format
  - Session ownership (user_id match)
  - Session active state (completed=false before claim)
  - Session age windows (min + max)
  - Score min/max model from lines and level rules
  - Session duration plausibility and heartbeat density
  - Heartbeat freshness
  - Per-user rate limiting
- submit-score claims session atomically before insert (replay-resistant).

### Database Hardening

- RLS enabled on scores, profiles, game_sessions.
- No direct access policy on game_sessions for authenticated role.
- Least privilege grants:
  - scores: authenticated SELECT only
  - profiles: authenticated SELECT/INSERT/UPDATE only
  - leaderboard: authenticated SELECT only
  - anon: no direct data access to scores/profiles/game_sessions/leaderboard
- scores.session_id linked to game_sessions(id) with unique index (one score per session).
- Trigger validates session ownership/completion on score insert.
- get_user_stats RPC execute rights restricted to authenticated and service_role.

## Residual Risks

- Highly sophisticated botting can still mimic legitimate timing patterns.
- Shared-account abuse is outside this model.
- If ALLOWED_ORIGINS is not maintained during domain changes, legitimate clients can be blocked.

## Operational Checklist

1. Keep verify_jwt=true on all score-related edge functions.
2. Maintain ALLOWED_ORIGINS when frontend domains change.
3. Rotate publishable keys if exposure is suspected.
4. Review Supabase security advisors after every migration.
5. Run periodic anomaly detection on score distributions.

## Incident Response (Score Abuse)

1. Temporarily disable submit-score function or block abusive origin.
2. Query suspicious score/session patterns (burst inserts, impossible ratios).
3. Delete/rollback invalid score rows by session_id.
4. Patch validation rules and redeploy edge functions.
5. Re-run advisor checks and post-incident audit.
