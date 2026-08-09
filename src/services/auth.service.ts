import { api } from '../lib/api';
import { authStore, type AuthSession, type AuthUser } from '../lib/authStore';
import type { Profile } from '../types';

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

export const authService = {
  async signUp({ email, password, username }: AuthCredentials): Promise<AuthSession> {
    const session = await api.post<AuthSession>(
      '/auth/signup',
      { email, password, username: username ?? email.split('@')[0] },
      { auth: false }
    );
    authStore.set(session);
    return session;
  },

  async signIn({ email, password }: AuthCredentials): Promise<AuthSession> {
    const session = await api.post<AuthSession>(
      '/auth/signin',
      { email, password },
      { auth: false }
    );
    authStore.set(session);
    return session;
  },

  async signOut(): Promise<void> {
    const refreshToken = authStore.getRefreshToken();

    try {
      if (refreshToken) {
        await api.post('/auth/signout', { refresh_token: refreshToken }, { auth: false });
      }
    } finally {
      // The local session is dropped even if revoking it server-side failed,
      // so signing out never leaves the user apparently still logged in.
      authStore.clear();
    }
  },

  /** Confirms the stored session is still valid and refreshes the cached user. */
  async getCurrentUser(): Promise<AuthUser> {
    const user = await api.get<AuthUser>('/auth/me');
    authStore.setUser(user);
    return user;
  },

  async getProfile(): Promise<Profile> {
    return api.get<Profile>('/profile/me');
  },

  async uploadAvatar(file: File): Promise<string> {
    const { avatar_url: avatarUrl } = await api.postRaw<{ avatar_url: string }>(
      '/profile/avatar',
      file,
      file.type
    );

    const session = authStore.get();
    if (session) authStore.setUser({ ...session.user, avatar_url: avatarUrl });

    return avatarUrl;
  },

  async removeAvatar(): Promise<void> {
    await api.delete('/profile/avatar');

    const session = authStore.get();
    if (session) authStore.setUser({ ...session.user, avatar_url: null });
  },

  async sendPresenceHeartbeat(): Promise<void> {
    await api.post('/presence');
  },
};
