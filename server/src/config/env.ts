import { config } from 'dotenv';
import { z } from 'zod';

// `override: true` is required: dotenv's default is to never overwrite a
// key that's already present in `process.env`. Without it, a stray
// DATABASE_URL exported in a developer's shell (e.g. left over from an
// unrelated one-off command against the dev DB) would silently shadow
// .env.test's value even with NODE_ENV=test set correctly — see
// server/src/config/dbSafety.ts for the runtime backstop against this.
config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env', override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
