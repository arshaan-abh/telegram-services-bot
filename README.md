# Telegram Services Bot

Production-ready Telegram bot built with TypeScript, grammY, Vercel, Neon Postgres, and Upstash.

## Stack

- grammY + `@grammyjs/menu` + `@grammyjs/conversations` + `@grammyjs/i18n`
- Vercel Serverless Functions
- Neon Postgres + Drizzle ORM + drizzle-kit migrations
- Upstash Redis (rate limiting + session)
- Upstash QStash (scheduled notifications)
- Zod v4 env validation
- pino logging + Sentry error tracking
- Vitest test suite

## Features

- User/Admin roles
- Service catalog and purchase flow
- Needed-fields profile reuse for repeated purchases
- Payment proof upload and admin review workflow
- Advanced discount code engine
- Referral credits and wallet spend
- Notification scheduling (reminder + ended + admin custom)
- Audit logs for admin actions
- English/Persian i18n (fixed by env)

## Project Structure

- `src/config` env + constants
- `src/db` schema + repositories
- `src/bot` runtime, handlers, conversations, menus
- `src/services` domain logic
- `src/security` webhook checks + rate limiting
- `api` Vercel endpoints
- `tests` unit/integration/harness

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill all required values.
3. Ensure `APP_BASE_URL` is your public base URL.

### Required Environment Variables

- `BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_ID`
- `BOT_NAME`
- `PRICE_UNIT`
- `CARD_NUMBER`
- `REFERRAL_PERCENT`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `APP_BASE_URL`
- `MAIN_CHANNEL_URL`

### Optional Environment Variables

- `BOT_LANGUAGE` (default: `en`)
- `APP_TIMEZONE` (default: `UTC`)
- `PRICE_DECIMALS` (default: `2`)
- `MAX_PROOF_SIZE_MB` (default: `5`)
- `LOG_LEVEL` (default: `info`)
- `SENTRY_DSN`
- `INTERNAL_WEBHOOK_SETUP_TOKEN`

### Secret Rotation Procedure

1. Add new secrets in Vercel as preview variables first.
2. For QStash signing keys, set both `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.
3. Promote the same values to production variables.
4. Redeploy production.
5. Verify `/api/health`, Telegram webhook delivery, and QStash dispatch.
6. Remove old secrets only after successful verification.

## Local Development

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Webhook Setup

```bash
pnpm set:webhook
```

Or call:

- `POST /api/internal/set-webhook` with header `x-internal-token: <INTERNAL_WEBHOOK_SETUP_TOKEN>`

## Testing

```bash
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
```

## Endpoints

- `POST /api/telegram/webhook`
- `POST /api/qstash/dispatch`
- `GET /api/health`
- `POST /api/internal/set-webhook`

## Runbooks

- `docs/runbooks/payment-dispute.md`
- `docs/runbooks/notification-retry.md`
- `docs/runbooks/credit-adjustment.md`
- `docs/deployment.md`

## Notes

- Telegram webhook requests are validated by secret token.
- QStash callbacks are signature-verified.
- Rate limiting is enabled for global traffic, proof uploads, discount attempts, and admin actions.
