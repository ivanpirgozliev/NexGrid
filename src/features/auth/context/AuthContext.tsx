import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

const PRESENCE_HEARTBEAT_MS = 30_000;

interface AuthContextValue {
  session: Session | null;
  user: SupabaseUser | null;
  username: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user: verifiedUser } }) => {
        if (verifiedUser) {
          setUser(verifiedUser);
          supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
          });
          fetchUsername(verifiedUser.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          (async () => {
            await fetchUsername(newSession.user.id);
          })();
        }
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setUsername(null);
        setIsLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    let isActive = true;

    async function sendPresenceHeartbeat() {
      const { error } = await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId);

      if (!isActive || !error) return;
      // Presence heartbeat errors are non-blocking for auth UI.
    }

    void sendPresenceHeartbeat();
    const heartbeatInterval = window.setInterval(() => {
      void sendPresenceHeartbeat();
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      isActive = false;
      window.clearInterval(heartbeatInterval);
    };
  }, [user?.id]);

  async function fetchUsername(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();
      setUsername(data?.username ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, username, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
