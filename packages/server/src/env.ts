import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().url().default('postgresql://localhost:5432/reqtrace'),
});

export const env = envSchema.parse(process.env);
