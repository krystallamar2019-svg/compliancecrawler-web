import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { getStripe, resolveTestPrice, type PaidPlanKey } from './billing/stripe.js';
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
import type { AuthenticatedRequest } from './types/auth.js';

const nextPaidPlan: Record<PaidPlanKey, PaidPlanKey | null> = {
  steward: 'harvest',
  harvest: 'abundance',
  abundance: null,
};

async function currentPaidSubscription(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id,plan_key,status,cancel_at_period_end,updated_at')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

  // Register membership actions directly so these critical billing routes cannot be lost
  // behind a nested router mount.
  app.post('/api/upgrade-membership', async (req, res, next) => {
    try {
      const { organizationId } = (req as AuthenticatedRequest).auth;
      const record = await currentPaidSubscription(organizationId);
      if (!record?.stripe_subscription_id) {
        res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
        return;
      }

      const currentPlan = String(record.plan_key ?? '').toLowerCase() as PaidPlanKey;
      if (!['steward', 'harvest', 'abundance'].includes(currentPlan)) {
        res.status(409).json({ error: 'UPGRADE_PLAN_UNAVAILABLE' });
        return;
      }
      const targetPlan = nextPaidPlan[currentPlan];
      if (!targetPlan) {
        res.status(409).json({ error: 'HIGHEST_PLAN_ACTIVE' });
        return;
      }
      if (record.cancel_at_period_end) {
        res.status(409).json({ error: 'SUBSCRIPTION_CANCELS_AT_PERIOD_END' });
        return;
      }

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);
      if (subscription.livemode) {
        res.status(409).json({ error: 'LIVE_SUBSCRIPTION_REJECTED_IN_TEST_BACKEND' });
        return;
      }
      const item = subscription.items.data[0];
      if (!item) {
        res.status(409).json({ error: 'SUBSCRIPTION_ITEM_REQUIRED' });
        return;
      }

      const targetPriceId = await resolveTestPrice(targetPlan);
      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: targetPriceId, quantity: 1 }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        expand: ['latest_invoice'],
      });

      const invoice = updated.latest_invoice;
      const paymentUrl = invoice && typeof invoice !== 'string' ? invoice.hosted_invoice_url ?? null : null;
      res.json({
        currentPlan,
        targetPlan,
        status: updated.pending_update ? 'payment_required' : 'upgraded',
        paymentUrl: updated.pending_update ? paymentUrl : null,
        renewalDateUnchanged: true,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/cancel-membership', async (req, res, next) => {
    try {
      const { organizationId } = (req as AuthenticatedRequest).auth;
      const record = await currentPaidSubscription(organizationId);
      if (!record?.stripe_subscription_id) {
        res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
        return;
      }
      if (record.cancel_at_period_end) {
        res.json({ status: 'already_scheduled', cancelAtPeriodEnd: true });
        return;
      }

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);
      if (subscription.livemode) {
        res.status(409).json({ error: 'LIVE_SUBSCRIPTION_REJECTED_IN_TEST_BACKEND' });
        return;
      }

      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
      res.json({ status: 'scheduled', cancelAtPeriodEnd: updated.cancel_at_period_end });
    } catch (error) {
      next(error);
    }
  });

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
