import { z } from 'zod';

const DEFAULT_JWT_SECRET = 'reqtrace-dev-secret-change-in-production';
const DEFAULT_API_KEY = 'reqtrace-dev-api-key-change-in-production';

const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().url().default('postgresql://localhost:5432/reqtrace'),
  JWT_SECRET: z.string().default(DEFAULT_JWT_SECRET),
  API_KEY: z.string().default(DEFAULT_API_KEY),
  /** Delete logs older than this many days. 0 disables time-based retention. */
  RETENTION_DAYS: z.coerce.number().min(0).default(0),
});

const parsed = envSchema.parse(process.env);

if (process.env.NODE_ENV === 'production') {
  const insecure: string[] = [];
  if (parsed.JWT_SECRET === DEFAULT_JWT_SECRET) insecure.push('JWT_SECRET');
  if (parsed.API_KEY === DEFAULT_API_KEY) insecure.push('API_KEY');
  if (insecure.length > 0) {
    throw new Error(
      `[reqtrace] refusing to start in production with the default ${insecure.join(' and ')}. ` +
      'Set them to your own values.',
    );
  }
}

export const env = parsed;
