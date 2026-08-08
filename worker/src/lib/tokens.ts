import { sign, verify } from 'hono/jwt';
import type { AuthUser } from '../types';

/** Pinned so a forged header cannot talk the verifier into another algorithm. */
const ALGORITHM = 'HS256';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface AccessTokenPayload {
  sub: string;
  email: string;
  exp: number;
  iat: number;
}

export async function createAccessToken(
  user: AuthUser,
  secret: string
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;

  const token = await sign(
    { sub: user.id, email: user.email, iat: issuedAt, exp: expiresAt },
    secret,
    ALGORITHM
  );

  return { token, expiresAt };
}

export async function readAccessToken(
  token: string,
  secret: string
): Promise<AuthUser | null> {
  try {
    // `verify` throws on a bad signature and on expiry.
    const payload = (await verify(
      token,
      secret,
      ALGORITHM
    )) as unknown as AccessTokenPayload;
    if (!payload?.sub || !payload?.email) return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 digest is
 * persisted, so a database leak cannot be replayed against the API.
 */
export function createRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
