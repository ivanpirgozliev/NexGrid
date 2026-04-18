import { supabase } from '../lib/supabase';

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

const AVATAR_BUCKET = 'avatars';

function getAvatarPath(userId: string): string {
  return `${userId}/avatar`;
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

  async uploadAvatar(userId: string, file: File) {
    const path = getAvatarPath(userId);

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: '0',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const avatarUrl = urlData.publicUrl;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (profileError) throw profileError;

    return avatarUrl;
  },

  async removeAvatar(userId: string) {
    const path = getAvatarPath(userId);

    const { error: deleteError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([path]);

    if (deleteError) throw deleteError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (profileError) throw profileError;
  },
};
