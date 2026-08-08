import { Hono } from 'hono';
import { cors } from './middleware/cors';
import { authRoutes } from './routes/auth';
import type { AppBindings } from './types';

const app = new Hono<AppBindings>();

app.use('*', cors);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', authRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

/*
  Internal failures are logged with detail but answered with a generic message —
  Postgres errors otherwise leak table and column names to the client.
*/
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.path} failed:`, err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
