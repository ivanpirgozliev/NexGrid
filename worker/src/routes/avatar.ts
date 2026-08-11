import { Hono } from 'hono';
import { getDb } from '../db';
import { avatarKey } from '../lib/avatars';
import { requireAuth } from '../middleware/auth';
import type { AppBindings } from '../types';

/*
  Limits carried over from the Supabase `avatars` bucket definition: 2MB, and
  JPEG/PNG/WebP only.
*/
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | undefined): value is AllowedType {
  return !!value && (ALLOWED_TYPES as readonly string[]).includes(value);
}

/**
 * The declared Content-Type decides how R2 later serves the object, so it is
 * checked against the actual leading bytes rather than trusted. Storage
 * policies could only ever check the label.
 */
function matchesMagicBytes(bytes: Uint8Array, contentType: AllowedType): boolean {
  if (contentType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, i) => bytes[i] === byte);
  }

  // WEBP: "RIFF" <4-byte size> "WEBP"
  const ascii = (offset: number, text: string) =>
    [...text].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
  return ascii(0, 'RIFF') && ascii(8, 'WEBP');
}

function publicUrl(env: { R2_PUBLIC_URL: string }, userId: string): string {
  return `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${avatarKey(userId)}`;
}

async function storeAvatar(
  bucket: R2Bucket,
  userId: string,
  body: ArrayBuffer,
  contentType: AllowedType
) {
  await bucket.put(avatarKey(userId), body, {
    httpMetadata: {
      contentType,
      // The object key never changes, so the URL is stable across replacements;
      // a short TTL keeps a new upload from lingering behind a cached old one.
      cacheControl: 'public, max-age=60',
    },
  });
}

export const avatarRoutes = new Hono<AppBindings>();

avatarRoutes.post('/profile/avatar', requireAuth, async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('Content-Type')?.split(';')[0].trim();

  if (!isAllowedType(contentType)) {
    return c.json({ error: 'Avatar must be a JPEG, PNG, or WebP image' }, 400);
  }

  const declaredLength = Number(c.req.header('Content-Length') ?? 0);
  if (declaredLength > MAX_AVATAR_BYTES) {
    return c.json({ error: 'Avatar must be 2MB or smaller' }, 413);
  }

  const body = await c.req.arrayBuffer();

  // Re-checked against the real body: Content-Length is caller-supplied.
  if (body.byteLength === 0) {
    return c.json({ error: 'Avatar file is empty' }, 400);
  }

  if (body.byteLength > MAX_AVATAR_BYTES) {
    return c.json({ error: 'Avatar must be 2MB or smaller' }, 413);
  }

  if (!matchesMagicBytes(new Uint8Array(body.slice(0, 16)), contentType)) {
    return c.json({ error: 'File contents do not match the declared image type' }, 400);
  }

  await storeAvatar(c.env.AVATARS, user.id, body, contentType);

  const url = publicUrl(c.env, user.id);
  await getDb(c.env)`
    UPDATE profiles SET avatar_url = ${url} WHERE id = ${user.id}
  `;

  return c.json({ avatar_url: url });
});

avatarRoutes.delete('/profile/avatar', requireAuth, async (c) => {
  const user = c.get('user');

  await c.env.AVATARS.delete(avatarKey(user.id));
  await getDb(c.env)`
    UPDATE profiles SET avatar_url = NULL WHERE id = ${user.id}
  `;

  return c.body(null, 204);
});
