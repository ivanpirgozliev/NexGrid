/*
  # Password hashing and login throttling

  Hashing runs inside Postgres via pgcrypto rather than in the Worker. The
  Cloudflare Free plan caps a request at 10ms of CPU, which a PBKDF2 or bcrypt
  round in the Worker would blow through; time spent waiting on the database is
  I/O, not CPU, so it does not count against that budget.

  A second benefit: `crypt()` verifies the `$2a$`-format bcrypt hashes carried
  over from Supabase's auth.users as-is, so imported users keep their passwords
  and nothing needs rehashing.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

/*
  GoTrue applied its own login rate limiting; without these columns the move off
  Supabase would leave sign-in open to unthrottled guessing.

  The lockout is deliberately short. A hard lock lets an attacker who knows an
  email address deny that user access at will, so this trades a slower brute
  force for a bounded, self-clearing lockout rather than a permanent one.
*/
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;
