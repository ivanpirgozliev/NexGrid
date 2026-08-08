import type { MiddlewareHandler } from 'hono';
import { readAccessToken } from '../lib/tokens';
import type { AppBindings } from '../types';

/**
 * Rejects the request unless it carries a valid, unexpired access token.
 * On success the decoded user is available as `c.get('user')`.
 */
export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401);
  }

  const user = await readAccessToken(header.slice(7), c.env.JWT_SECRET);
  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', user);
  await next();
};
