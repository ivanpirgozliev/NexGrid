import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';

/*
  Ported from the Supabase edge functions' origin allowlist, with the wildcard
  Netlify entries dropped — NexGrid ships as a desktop app now.

  A request with no Origin header is allowed: that is what the packaged Electron
  build sends. This is not a CSRF hole, because the API authenticates with a
  Bearer token read from localStorage and never with an ambient cookie, so a
  hostile page cannot get the browser to attach credentials on its behalf.
*/
function parseAllowedOrigins(env: string): string[] {
  return env
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

export const cors: MiddlewareHandler<AppBindings> = async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);

  // Electron's packaged renderer sends "null" or omits the header entirely.
  const isNativeApp = !origin || origin === 'null';
  const isAllowed = isNativeApp || allowed.includes(origin.replace(/\/+$/, ''));

  if (!isAllowed) {
    return c.json({ error: 'Origin not allowed' }, 403);
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && origin !== 'null') {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  await next();

  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
};
