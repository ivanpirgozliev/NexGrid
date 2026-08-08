import bcrypt from 'bcryptjs';

/*
  Two hash formats coexist:

  - `pbkdf2$sha256$<iterations>$<salt-b64>$<hash-b64>` — what this Worker writes.
    PBKDF2 is used because it is the only password KDF exposed natively by
    WebCrypto on Workers; scrypt/argon2 would have to run in pure JS.
  - `$2a$…` / `$2b$…` — bcrypt hashes carried over from Supabase's auth.users.
    These are verified with bcryptjs on first sign-in and then transparently
    rehashed to PBKDF2, so the JS bcrypt path disappears after one login.
*/

const ITERATIONS = 210_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface VerifyResult {
  valid: boolean;
  /** Set when the stored hash uses a legacy format and should be replaced. */
  needsRehash: boolean;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<VerifyResult> {
  if (storedHash.startsWith('$2')) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid };
  }

  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
    return { valid: false, needsRehash: false };
  }

  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return { valid: false, needsRehash: false };
  }

  const derived = await pbkdf2(password, fromBase64(parts[3]), iterations);
  const valid = timingSafeEqual(derived, fromBase64(parts[4]));

  return { valid, needsRehash: valid && iterations < ITERATIONS };
}
