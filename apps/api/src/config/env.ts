import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  DEV_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_INITDATA_MAX_AGE: z.coerce.number().int().positive().default(86400),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  FRESHNESS_FRESH_HOURS: z.coerce.number().positive().default(24),
  FRESHNESS_STALE_HOURS: z.coerce.number().positive().default(72),
  OPTIMIZER_MAX_EVALUATIONS: z.coerce.number().int().positive().default(200_000),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(600),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

if (env.NODE_ENV === 'production' && env.DEV_MODE) {
  throw new Error('DEV_MODE must not be enabled in production');
}

export const freshnessPolicy = {
  freshHours: env.FRESHNESS_FRESH_HOURS,
  staleHours: env.FRESHNESS_STALE_HOURS,
};

export const allowedOrigins = env.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
