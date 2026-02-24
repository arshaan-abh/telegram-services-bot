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

## Notes

- Telegram webhook requests are validated by secret token.
- QStash callbacks are signature-verified.
- Rate limiting is enabled for global traffic, proof uploads, discount attempts, and admin actions.
