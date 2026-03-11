import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-safe', 10);

function validateInput(email: string, password: string): string | null {
  if (!email || !EMAIL_RE.test(email)) return 'Invalid email';
  if (!password || password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

export function authRoutes(pool: pg.Pool) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get('/auth/status', async () => {
      const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      return { registered: result.rows[0].count > 0 };
    });

    app.post<{ Body: { email: string; password: string } }>('/auth/register', async (request, reply) => {
      const { email, password } = request.body;

      const error = validateInput(email, password);
      if (error) return reply.code(400).send({ error });

      const hash = await bcrypt.hash(password, 10);
      const token = app.jwt.sign({ email });

      // Atomic: only inserts if no users exist (prevents race condition)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, token)
         SELECT $1, $2, $3
         WHERE (SELECT COUNT(*) FROM users) = 0
         RETURNING id`,
        [email, hash, token],
      );

      if (result.rowCount === 0) {
        return reply.code(403).send({ error: 'Registration is closed' });
      }

      return { token };
    });

    app.post<{ Body: { email: string; password: string } }>('/auth/login', {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    }, async (request, reply) => {
      const { email, password } = request.body;

      const error = validateInput(email, password);
      if (error) return reply.code(400).send({ error });

      // Timing-safe: always compare even if user not found
      const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
      const hash = result.rows.length > 0 ? result.rows[0].password_hash : DUMMY_HASH;
      const valid = await bcrypt.compare(password, hash);

      if (!valid || result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = app.jwt.sign({ email });
      await pool.query('UPDATE users SET token = $1 WHERE email = $2', [token, email]);
      return { token };
    });

    app.post('/auth/logout', async (request, reply) => {
      try {
        await request.jwtVerify();
        const { email } = request.user as { email: string };
        const authHeader = request.headers.authorization;
        const token = authHeader?.split(' ')[1];
        const result = await pool.query('SELECT token FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0 || result.rows[0].token !== token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        await pool.query('UPDATE users SET token = NULL WHERE email = $1', [email]);
        return { ok: true };
      } catch (err) {
        console.error('[reqtrace] logout error:', err);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    });
  };
}
