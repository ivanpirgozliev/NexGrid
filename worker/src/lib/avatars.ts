/**
 * The R2 key for a user's avatar. Shared so that upload, removal and account
 * deletion cannot drift apart on where the object lives.
 */
export function avatarKey(userId: string): string {
  return `avatars/${userId}/avatar`;
}
