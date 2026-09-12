import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { supabaseAdmin } from './lib/supabase.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { adminRouter } from './routes/admin.js';
import { agreementReviewsRouter } from './routes/agreementReviews.js';
import { billingRouter } from './routes/billing.js';
import { fitCheckRouter } from './routes/fitCheck.js';
import { meRouter } from './routes/me.js';
import { reportsRouter } from './routes/reports.js';
import { scansRouter } from './routes/scans.js';
import { sitesRouter } from './routes/sites.js';
import { stripeWebhookHandler } from './routes/stripeWebhook.js';
import { usageRouter } from './routes/usage.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.slice(0, 128) || randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'brandedalign-api' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      const { error } = await supabaseAdmin
        .from('organizations')
        .select('id', { head: true, count: 'exact' });
      if (error) throw error;
      res.json({ status: 'ready', service: 'brandedalign-api', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', service: 'brandedalign-api' });
    }
  });

  // Stripe signature verification requires the untouched raw request bytes.
  // This route must stay before express.json().
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    stripeWebhookHandler,
  );

  app.use(cors({
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-BrandedAlign-Org', 'Idempotency-Key'],
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.ALLOWED_ORIGINS_LIST.includes(origin)) return callback(null, true);
      return callback(new Error('CORS_ORIGIN_DENIED'));
    },
  }));

  app.use(express.json({ limit: '256kb', type: 'application/json' }));

  const fitCheckLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'FIT_CHECK_RATE_LIMITED' },
  });

  // Public by design, but deliberately narrow: one page, SSRF guarded, no account data.
  app.use('/api/fit-check', fitCheckLimiter, fitCheckRouter);

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED' },
  });

  app.use('/api', apiLimiter);
  app.use('/api', requireAuth);

  app.use('/api/me', meRouter);
  app.use('/api', billingRouter);
  app.use('/api/agreement-reviews', agreementReviewsRouter);
  app.use('/api/scans', scansRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/sites', sitesRouter);
  app.use('/api/usage', usageRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
