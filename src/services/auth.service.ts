import { supabase } from '../lib/supabase';

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

export const authService = {
  async signUp({ email, password, username }: AuthCredentials) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username ?? email.split('@')[0] },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
