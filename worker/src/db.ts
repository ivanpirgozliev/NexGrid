import { neon } from '@neondatabase/serverless';
import type { Env } from './types';

/*
  The HTTP driver is used rather than a pooled TCP client: each query is a
  single stateless request, which is what a Worker isolate can actually hold
  onto between invocations. Multi-statement atomicity is expressed with
  data-modifying CTEs instead of BEGIN/COMMIT.
*/
export function getDb(env: Env) {
  return neon(env.DATABASE_URL);
}

export type Db = ReturnType<typeof getDb>;

/** Postgres unique-violation, raised when an email is already registered. */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}
