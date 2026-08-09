import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { authStore, type AuthSession, type AuthUser } from '../../../lib/authStore';
import { authService } from '../../../services/auth.service';

const PRESENCE_HEARTBEAT_MS = 30_000;

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  username: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    authStore.subscribe,
    authStore.get,
    () => null
  );

  /*
    The session is restored from localStorage synchronously, so a returning user
    lands on their page without an auth flash. isLoading only covers the
    round trip that confirms the stored token has not been revoked or expired.
  */
  const [isLoading, setIsLoading] = useState(() => authStore.get() !== null);

  useEffect(() => {
    if (!authStore.get()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    authService
      .getCurrentUser()
      .catch(() => {
        // api.ts already cleared the session if the refresh token was rejected.
        // Anything else (a network blip) leaves the cached session in place.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;

    let active = true;

    function sendPresence() {
      // Presence is best-effort: a failure must not disturb the auth UI.
      void authService.sendPresenceHeartbeat().catch(() => {});
    }

    sendPresence();
    const interval = window.setInterval(() => {
      if (active) sendPresence();
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        username: session?.user.username ?? null,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
