import { z } from 'zod';

const optionalUrl = z.string().url().optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_STEWARD_PRICE_ID: z.string().min(1).optional(),
  STRIPE_HARVEST_PRICE_ID: z.string().min(1).optional(),
  STRIPE_ABUNDANCE_PRICE_ID: z.string().min(1).optional(),
  APP_URL: optionalUrl,
  STRIPE_SUCCESS_URL: optionalUrl,
  STRIPE_CANCEL_URL: optionalUrl,
  CAPHUB_WEBHOOK_URL: optionalUrl,
  CAPHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  CRAWLER_API_SECRET: z.string().min(1).optional(),
  REPORT_SIGNING_SECRET: z.string().min(1).optional(),
  SENTRY_DSN: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().default(''),
  REDIS_URL: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (!value.SUPABASE_SECRET_KEY && !value.SUPABASE_SERVICE_ROLE_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['SUPABASE_SECRET_KEY'],
      message: 'Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY (legacy compatibility).',
    });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid backend configuration: ${issues}`);
}

const raw = parsed.data;

export const config = {
  ...raw,
  SUPABASE_SERVER_KEY: raw.SUPABASE_SECRET_KEY ?? raw.SUPABASE_SERVICE_ROLE_KEY!,
  ALLOWED_ORIGINS_LIST: raw.ALLOWED_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean),
  SUPABASE_ISSUER: `${raw.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`,
  SUPABASE_JWKS_URL: `${raw.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`,
} as const;

export type AppConfig = typeof config;
