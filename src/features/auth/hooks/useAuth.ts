import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, type AuthCredentials } from '../../../services/auth.service';

const LOGIN_COOLDOWN_MS = 2000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function sanitizeAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid email') || lower.includes('invalid credentials'))
    return 'Invalid email or password';
  if (lower.includes('email not confirmed'))
    return 'Please confirm your email before signing in';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'Unable to create account. Please try a different email.';
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Too many attempts. Please wait and try again.';
  return 'An unexpected error occurred. Please try again.';
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  const attemptsRef = useRef(0);
  const lastAttemptRef = useRef(0);
  const lockedUntilRef = useRef(0);

  const checkRateLimit = useCallback((): string | null => {
    const now = Date.now();
    if (now < lockedUntilRef.current) {
      const remaining = Math.ceil((lockedUntilRef.current - now) / 1000);
      return `Too many attempts. Please wait ${remaining} seconds.`;
    }
    if (now - lastAttemptRef.current < LOGIN_COOLDOWN_MS) {
      return 'Please wait before trying again.';
    }
    return null;
  }, []);

  const recordAttempt = useCallback((success: boolean) => {
    const now = Date.now();
    lastAttemptRef.current = now;
    if (success) {
      attemptsRef.current = 0;
    } else {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockedUntilRef.current = now + LOCKOUT_MS;
        attemptsRef.current = 0;
      }
    }
  }, []);

  async function signIn(credentials: AuthCredentials) {
    const rateLimitMsg = checkRateLimit();
    if (rateLimitMsg) {
      setError(rateLimitMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      await authService.signIn(credentials);
      recordAttempt(true);
      navigate('/game');
    } catch (err) {
      recordAttempt(false);
      const raw = err instanceof Error ? err.message : '';
      setError(sanitizeAuthError(raw));
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(credentials: AuthCredentials) {
    const rateLimitMsg = checkRateLimit();
    if (rateLimitMsg) {
      setError(rateLimitMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      // The API signs the user in as part of signing up — there is no email
      // confirmation step to wait on, unlike the old Supabase flow.
      await authService.signUp(credentials);
      recordAttempt(true);
      navigate('/game');
    } catch (err) {
      recordAttempt(false);
      const raw = err instanceof Error ? err.message : '';
      setError(sanitizeAuthError(raw));
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    setIsLoading(true);
    try {
      await authService.signOut();
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  }

  return { signIn, signUp, signOut, isLoading, error, info, setError };
}
