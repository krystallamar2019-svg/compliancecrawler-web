# BrandedAlign backend

TypeScript/Express backend for BrandedAlign. This directory is intentionally separate from the existing frontend and existing Python Railway services so the new backend can be validated before cutover.

## Security model

- Supabase Auth authenticates users.
- The API verifies the Supabase bearer token and resolves organization membership server-side.
- Request bodies never choose an organization, plan, Stripe price, scan allowance, or entitlement.
- Stripe webhooks are the payment source of truth.
- Protected entitlement, quota, scan result, audit, verification, and admin writes are server-controlled.
- Tenant data is protected by Supabase RLS.
- Scan creation and quota reservation are atomic and idempotent.
- Public URL crawling blocks non-HTTP schemes, URL credentials, localhost, private/link-local/multicast/reserved/CGNAT/metadata addresses, DNS rebinding, arbitrary ports, excessive redirects, unsupported content types, and oversized responses.
- Launch crawler mode disables page JavaScript and non-document subresources. A separately reviewed rendered-JavaScript mode may be added later.
- BrandedAlign findings are screening results. The system does not state that a business is legally compliant, noncompliant, scientifically substantiated, accessibility-conformant, or privacy-compliant.

## Repository layout

- `src/index.ts` — API entry point
- `src/app.ts` — Express security middleware and routes
- `src/middleware` — auth, admin, safe error handling
- `src/routes` — customer/admin API endpoints
- `src/security` — URL/SSRF controls and safe text fetcher
- `src/crawler` — isolated Playwright crawler
- `src/analysis` — conservative deterministic screening rules
- `src/reports` — transparent screening score generator
- `src/queue` — BullMQ queues
- `src/worker` — scan and CapHub workers
- `src/integrations` — signed outbound CapHub delivery
- `../supabase/migrations` — additive Supabase migrations
- `../supabase/seed.sql` — non-personal plan seed data

## Required services

1. Supabase project with Auth + Postgres.
2. Stripe test-mode account/keys during validation.
3. Railway Redis-compatible service for BullMQ.
4. Railway API service built from `backend/Dockerfile.api`.
5. Railway worker service built from `backend/Dockerfile.worker`.
6. Optional CapHub HTTPS webhook receiver.

## Environment variables

Copy `.env.example` names into the appropriate Railway services. Never commit values.

### Both API and worker

- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` preferred, or legacy `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `REPORT_SIGNING_SECRET`

### API

- `PORT`
- `ALLOWED_ORIGINS`
- `APP_URL`
- `STRIPE_SECRET_KEY` — must be a Stripe **test-mode** `sk_test_...` key in this build
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STEWARD_PRICE_ID` optional override
- `STRIPE_HARVEST_PRICE_ID` optional override
- `STRIPE_ABUNDANCE_PRICE_ID` optional override
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

If Stripe plan price overrides are omitted, the API reads the active plan's `stripe_test_price_id` from `subscription_plans` server-side.

### Worker / optional integrations

- `CAPHUB_WEBHOOK_URL`
- `CAPHUB_WEBHOOK_SECRET`
- `SENTRY_DSN` when error monitoring is connected
- `EMAIL_PROVIDER_API_KEY` when email delivery is connected

Unused integrations must fail honestly rather than generating fake data.

## Browser configuration

The browser may receive only public configuration such as:

- `SUPABASE_URL`
- Supabase publishable/anon key
- BrandedAlign API base URL

Never expose server/secret Supabase keys, Stripe secret keys, Stripe webhook secrets, CapHub secrets, signing secrets, Redis URLs, or crawler secrets to frontend code.

## Supabase migration order

Apply in numeric order only after testing the branch:

1. `0001_init.sql` — additive canonical backend tables/RLS while preserving existing tables.
2. `0002_backend_hardening.sql` — org-scoped idempotency, findings FKs, atomic scan+quota transaction.
3. `0003_admin_rpc.sql` — service-role-only admin role lookup bridge.
4. `0004_subscription_v2.sql` — non-breaking current Stripe subscription entitlement updater.

The V2 subscription RPC intentionally leaves the current Python backend's existing RPC unchanged.

Do not run `seed.sql` against production merely to populate Stripe data. It intentionally contains no Stripe price IDs or customer/payment records.

## Railway services

### API service

- Source: this repository/validated branch.
- Root directory: `/backend`
- Dockerfile: `Dockerfile.api`
- Health check: `/health`
- Public networking: enabled for the API domain.
- Start command is supplied by the Dockerfile.

### Worker service

- Source: same repository/validated branch.
- Root directory: `/backend`
- Dockerfile: `Dockerfile.worker`
- Public networking: disabled; the worker does not need an inbound public URL.
- Worker runs as the non-root Playwright `pwuser`.

### Redis

Use a private Railway Redis-compatible service. Provide its private connection URL as `REDIS_URL` to API and worker. Do not expose Redis publicly.

## Stripe test-mode setup

1. Keep the backend test-mode-only until checkout and webhook tests pass.
2. Configure active Steward, Harvest, and Abundance **test** Price IDs in Supabase or Railway environment overrides.
3. Create a Stripe webhook endpoint pointing to:
   `/api/stripe/webhook`
4. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.payment_failed`
5. Store the webhook signing secret only in the API service.
6. The Checkout success page never grants access. Entitlement changes only after a verified webhook.
7. Checkout writes `supabase_org_id` to both Checkout Session metadata and Subscription metadata.

A later live-mode launch should use a distinct configuration/cutover checklist. Do not mix test and live Stripe secrets or object IDs.

## API summary

Public:

- `GET /health`
- `POST /api/stripe/webhook` — Stripe signature required

Authenticated:

- `GET /api/me`
- `POST /api/checkout`
- `POST /api/billing-portal`
- `POST /api/scans`
- `GET /api/scans`
- `GET /api/scans/:id`
- `GET /api/reports`
- `GET /api/reports/:id`
- `POST /api/sites`
- `POST /api/sites/:id/verify`
- `POST /api/sites/:id/verify/check`
- `GET /api/usage`

Admin:

- `GET /api/admin/me`
- `POST /api/admin/sites/:id/manual-verify`

Admin routes require an active server-side admin role and an `aal2` Supabase MFA session. Sensitive manual verification also requires a recently issued access token.

## Scan request contract

`POST /api/scans` requires an `Idempotency-Key` header.

- `just_compliance` performs the limited public screening flow.
- `full_brand_audit` requires an active verified site belonging to the caller's organization.
- Plan, page limit, billing period, entitlement, and quota are resolved by the server.
- Scan creation and one-unit quota reservation happen in one Postgres transaction.

## Domain verification

Supported customer methods:

- DNS TXT
- HTML file under `/.well-known/`
- HTML meta tag

The raw verification token is returned once to the authenticated customer. Supabase stores only a SHA-256 hash in the canonical verification table. Tokens expire and previous pending challenges are revoked when a new one is created.

Manual verification is admin-only and audited.

## CapHub synchronization

CapHub sync is outbound-only in this build.

- HTTPS required.
- Payloads are minimal, high-level status fields only.
- Each event has an idempotency event ID and timestamp.
- The body is HMAC-SHA256 signed with `CAPHUB_WEBHOOK_SECRET`.
- BullMQ retries failed deliveries.
- Full crawl content, raw findings, passwords, auth tokens, payment secrets, and Supabase server keys are never sent.

## Testing

Run:

```bash
npm install
npm run typecheck
npm test
```

Unit tests cover URL normalization/SSRF ranges, screening score behavior, and conservative compliance-sensitive wording.

Integration tests use dedicated test configuration and must never point at the live customer environment. The required integration matrix includes:

- invalid Stripe webhook signature rejection
- Stripe event idempotency
- subscription entitlement changes
- quota enforcement and parallel scan requests
- URL redirect destination revalidation
- domain verification
- RLS tenant isolation
- customer vs. admin authorization

## Launch gate

Do not replace the existing backend merely because the branch compiles. Cutover requires all of the following:

1. TypeScript build and tests pass.
2. Migrations apply cleanly to a staging/test database or reviewed clone.
3. Stripe test Checkout completes and webhook activates the correct org exactly once.
4. Concurrent scan tests prove quota cannot double-consume.
5. SSRF tests block private/metadata/rebinding cases.
6. Domain verification succeeds for a controlled test domain.
7. Tenant A cannot read Tenant B data through API or Supabase RLS.
8. Non-admin users cannot access admin routes; admin route requires AAL2.
9. Worker crawls a controlled public test site and creates a report without raw HTML retention.
10. CapHub receives only approved minimal signed fields when configured.
11. API and worker logs contain no secrets or raw customer crawl content.
12. Rollback path keeps the current Python API/worker available until the new services are proven.

Only after those gates pass should frontend API traffic be switched to the new service and the old backend considered for retirement.
