/*
  Mirrors src/utils/validation.ts on the client. The client rules are UX; these
  are the enforced ones, since anything talking to this API can skip the UI.
*/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const MAX_EMAIL_LENGTH = 254;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates beyond this

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_REGEX.test(email)) return null;
  return email;
}

/** Same scoring as the client's checkPasswordStrength; valid at score >= 2. */
function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string') return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
  }
  if (passwordScore(value) < 2) {
    return 'Password is too weak - add uppercase, numbers, or symbols';
  }
  return null;
}

export function validateUsername(value: unknown): string | null {
  if (typeof value !== 'string') return 'Username is required';
  const username = value.trim();
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 24) return 'Username must be 24 characters or fewer';
  if (!USERNAME_REGEX.test(username)) {
    return 'Username may only contain letters, numbers, and underscores';
  }
  return null;
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
