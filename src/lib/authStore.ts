/*
  Holds the signed-in session and keeps it in localStorage.

  Supabase's client owned this state before and notified the app through
  onAuthStateChange; this is the equivalent, reduced to what NexGrid actually
  uses. Components read it through useSyncExternalStore in AuthContext, so a
  sign-in or a token refresh anywhere reaches every subscriber.
*/

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

const STORAGE_KEY = 'nexgrid.session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed?.access_token || !parsed?.refresh_token || !parsed?.user?.id) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    // Corrupt or unreadable storage is treated as signed out.
    return null;
  }
}

let current: AuthSession | null = readStoredSession();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const authStore = {
  get(): AuthSession | null {
    return current;
  },

  getAccessToken(): string | null {
    return current?.access_token ?? null;
  },

  getRefreshToken(): string | null {
    return current?.refresh_token ?? null;
  },

  set(session: AuthSession) {
    current = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // A full or unavailable localStorage still leaves the session usable
      // for this tab; it just will not survive a restart.
    }
    emit();
  },

  /** Replaces the user without touching tokens, e.g. after an avatar change. */
  setUser(user: AuthUser) {
    if (!current) return;
    this.set({ ...current, user });
  },

  clear() {
    current = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing useful to do if storage rejects the removal.
    }
    emit();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
