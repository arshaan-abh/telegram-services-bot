# PLAN.md - Telegram Services Bot (TypeScript + grammY + Vercel)

## Summary

Build a production-ready Telegram bot on Vercel with two roles (`user`, `admin`), service catalog + purchase workflow, payment-proof review, discounts, referrals, credit wallet, notification scheduling with QStash, bilingual content (English/Persian), strong validation, rate limiting, audit logs, and test coverage.  
This plan is decision-complete and implementation-ready.

## Locked Product Decisions

- [x] `payment_flow`: If payable amount is `0`, skip payment proof upload, but still require admin activation.
- [x] `expiry_alert_policy`: Send reminder once `3 days` before expiry and send ended notification on expiry date.
- [x] `discount_scope`: Advanced rules in v1.
- [x] `price_order`: Apply discount first, then apply user credit.
- [x] `channel_gate`: Soft promotion only (no membership gate).
- [x] `lang_policy`: Fixed env language for all users (both locales exist, active locale set by env).
- [x] `timezone_policy`: Use `APP_TIMEZONE` env with `UTC` fallback.
- [x] `referral_when`: Grant inviter credit only after admin activation.
- [x] `repurchase_policy`: If needed-field values match existing active subscription, renew/extend; if values differ, create a new parallel subscription.

## Public APIs, Interfaces, and Types

### HTTP Endpoints (Vercel Functions)

- `POST /api/telegram/webhook`
- `POST /api/qstash/dispatch`
- `GET /api/health`
- `POST /api/internal/set-webhook` (optional script-protected setup endpoint for deployment automation)

### Telegram Commands

- `/start` (supports referral payload `ref_<token>`)
- `/menu`
- `/services`
- `/my_services`
- `/wallet`
- `/referral`
- `/admin` (admin only)

### Callback Data Contract (versioned)

- `v1:svc:list:<page>`
- `v1:svc:view:<serviceId>`
- `v1:svc:buy:<serviceId>`
- `v1:buy:confirm:<draftId>`
- `v1:buy:edit:<draftId>:<fieldKey>`
- `v1:buy:cancel:<draftId>`
- `v1:admin:order:view:<orderId>`
- `v1:admin:order:done:<orderId>`
- `v1:admin:order:dismiss:<orderId>`
- `v1:admin:order:contact:<orderId>`
- `v1:discount:apply:<draftId>`
- `v1:notify:dismiss:<notificationId>`

### Core Domain Types

```ts
type Role = "user" | "admin";

type Service = {
  id: string;
  title: string;
  price: string; // numeric string from DB
  priceUnit: string; // env default "dollar"
  description: string | null;
  notes: string[]; // JSONB
  neededFields: string[]; // JSONB
  durationDays: number; // smallint
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OrderStatus =
  | "draft"
  | "awaiting_proof"
  | "awaiting_admin_review"
  | "approved"
  | "dismissed"
  | "cancelled";

type SubscriptionStatus = "active" | "expired";

type NotificationState = "pending" | "sent" | "failed" | "cancelled";

type DiscountType = "percent" | "fixed";
```

### Database Schema (Drizzle + Neon)

- `users`
- `services`
- `service_field_profiles` (per user+service needed-field values, reusable/editable)
- `orders` (purchase attempts with pricing snapshot, proof info, admin review state)
- `subscriptions` (active/expired entitlements with `startedAt + durationDays`)
- `discount_codes`
- `discount_code_services` (many-to-many scope)
- `discount_redemptions`
- `credit_ledger` (referral rewards, spend, admin adjustments)
- `referrals` (inviter-invitee relation)
- `notifications` (QStash-backed, pending/sent lifecycle)
- `audit_logs` (admin actions and critical state changes)

## Assumptions and Defaults

- [x] Admin identity is enforced by `ADMIN_TELEGRAM_ID` (numeric Telegram user id).
- [x] Service requires `title` field even though not explicitly listed, because list/detail UX depends on it.
- [x] Monetary values use `numeric(12,2)` in DB; label unit is from env `PRICE_UNIT`.
- [x] Proof image allowed MIME types: `image/jpeg`, `image/png`, `image/webp`; reject others.
- [x] Proof max size default `5MB` (configurable env).
- [x] Referral reward base amount = discounted price before credit spend.
- [x] Locale shown to all users is env-selected (`BOT_LANGUAGE`), no per-user switching.
- [x] Channel is promoted in menus/messages only, never required for access.
- [x] Dates displayed using `APP_TIMEZONE`, fallback `UTC`.

## Phase-Based Task Plan

## Phase 1 - Project Bootstrap and Tooling

- [x] Initialize TypeScript project structure for Vercel serverless functions (`src/`, `api/`, `drizzle/`, `locales/`, `tests/`).
- [x] Add runtime deps: `grammy`, `@grammyjs/conversations`, `@grammyjs/menu`, `@grammyjs/i18n`, `zod@4`, `drizzle-orm`, `@neondatabase/serverless`, `@upstash/redis`, `@upstash/ratelimit`, `@upstash/qstash`, `pino`, `@sentry/node`, `date-fns`, `date-fns-tz`.
- [x] Add dev deps: `drizzle-kit`, `vitest`, `@vitest/coverage-v8`, `eslint`, `@typescript-eslint/*`, `prettier`, `tsx`, `dotenv-cli`, `tsup`.
- [x] Configure scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `test:coverage`, `db:generate`, `db:migrate`, `db:studio`, `set:webhook`.
- [x] Configure ESLint + Prettier integration and strict TS config.
- [x] Create baseline module boundaries: `config`, `bot`, `features`, `db`, `services`, `adapters`, `observability`, `security`.
- [x] Add `README` sections for local run, env setup, webhook setup, and testing.

## Phase 2 - Env Validation and App Configuration

- [x] Implement `env.ts` with Zod v4 fail-fast validation at startup.
- [x] Required env vars: `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_ID`, `BOT_NAME`, `PRICE_UNIT`, `CARD_NUMBER`, `REFERRAL_PERCENT`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `APP_BASE_URL`, `MAIN_CHANNEL_URL`.
- [x] Optional env vars with defaults: `BOT_LANGUAGE=en`, `APP_TIMEZONE=UTC`, `PRICE_DECIMALS=2`, `MAX_PROOF_SIZE_MB=5`, `SENTRY_DSN`, `LOG_LEVEL=info`.
- [x] Enforce constraints: `REFERRAL_PERCENT` between `0` and `100`, `ADMIN_TELEGRAM_ID` as bigint-safe string, valid URL formats.
- [x] Implement typed config export to avoid raw `process.env` access outside config module.

## Phase 3 - Database Design and Migrations (Drizzle + Neon)

- [x] Define Drizzle schema files for all tables and enums.
- [x] Add DB indices for query hot paths (user lookup, pending orders, active subscriptions, pending notifications, discount code lookup).
- [x] Add unique constraints: `users.telegram_id`, `discount_codes.code`, `referrals.invitee_user_id`.
- [x] Add check constraints: non-negative pricing and credits, duration bounds (`1..255`), valid percentage ranges.
- [x] Add audit-friendly columns: `created_at`, `updated_at`, `created_by`, `updated_by` where needed.
- [x] Generate initial migration with `drizzle-kit`.
- [x] Add seed script for admin bootstrap sanity check and optional demo service.
- [x] Add transaction helpers for approval flow, credit ledger writes, and referral rewards.

## Phase 4 - Bot Runtime, Middleware, and i18n

- [x] Build bot singleton factory and middleware pipeline.
- [x] Add middleware order: request id, logger context, sentry context, admin resolver, session, rate-limit checks, i18n, menus, conversations, error boundary.
- [x] Configure `@grammyjs/i18n` with `en` and `fa` files while selecting locale strictly from env.
- [x] Create consistent message helpers with markdown-safe escaping and reusable templates.
- [x] Implement user-friendly loading behavior: immediate `answerCallbackQuery`, `sendChatAction`, and temporary "processing" messages for long operations.
- [x] Add global unknown-command and unknown-callback handlers.

## Phase 5 - User Features (Catalog, Buy Flow, Wallet, Referral)

- [x] Build `@grammyjs/menu` user home screen with entries: services, my services, wallet, referral, channel.
- [x] Implement service list pagination and service detail screen (price, unit, description, notes, duration, buy button).
- [x] Implement buy conversation (`@grammyjs/conversations`) steps:
- [x] Step: create order draft with price snapshot.
- [x] Step: load reusable needed-field profile for user+service.
- [x] Step: if no profile, collect needed fields with per-field validation.
- [x] Step: show collected values in readable summary and allow field-level correction loop.
- [x] Step: optionally apply discount code with validation result and recalculated totals.
- [x] Step: apply available user credit after discount and compute payable.
- [x] Step: if payable `> 0`, show card number and wait for valid proof image.
- [x] Step: if payable `= 0`, skip proof and submit directly to admin queue.
- [x] Step: finalize order state and notify admin.
- [x] Enforce proof acceptance only when order is in `awaiting_proof`.
- [x] Reject non-image media for proof uploads with clear error message.
- [x] Save Telegram `file_id`, mime info, and submission metadata for proof.
- [x] Implement `/my_services` view showing active and expired subscriptions with localized date formatting.
- [x] Implement referral screen with invite link `https://t.me/<BOT_NAME>?start=ref_<token>` and current credit balance.
- [x] Promote official channel using persistent button in main menus and onboarding messages.

## Phase 6 - Admin Features (Service CRUD, Order Review, Notifications)

- [x] Build admin menu with entries: pending orders, services, discounts, notifications, audit quick-view.
- [x] Implement service CRUD conversations:
- [x] Create service (title, price, description, notes, needed fields, duration).
- [x] Edit service fields with validation and confirmation.
- [x] Remove/deactivate service with confirmation.
- [x] Implement pending order review card containing:
- [x] User identity: telegram id, username, deep link mention.
- [x] Service + pricing breakdown: base, discount, credit, payable.
- [x] Needed-field values summary.
- [x] Discount code used info.
- [x] Proof media (if provided).
- [x] Implement admin actions:
- [x] `Done`: confirms fulfillment and activates subscription.
- [x] `Dismiss`: collect mandatory explanation text then ask final confirmation.
- [x] `Contact user`: provide actionable user info and quick mention link.
- [x] On dismissal, send explanation to user and close order.
- [x] On done, notify user service is active and include expiry date.
- [x] Implement admin immediate notifications and scheduled notifications UI.
- [x] Support audience choices for notifications: single user, all users, subscribers of service.

## Phase 7 - Discount Engine (Advanced Rules)

- [x] Implement discount code CRUD from admin menu.
- [x] Support rule fields: code, type (`percent|fixed`), amount, min order amount, max discount cap, active flag, start/end window, total usage limit, per-user limit, first-purchase-only, service scope.
- [x] Implement deterministic validation order and user-readable rejection reasons.
- [x] Persist redemption records per order.
- [x] Ensure code application is idempotent inside conversation retries.
- [x] Display discount impact in both user summary and admin review payload.

## Phase 8 - Referral and Credit Ledger

- [x] Track inviter on first valid `/start ref_*` only.
- [x] Block self-referral and referral overwrite.
- [x] On admin approval, compute reward as `discounted_amount * REFERRAL_PERCENT / 100`.
- [x] Write reward and spend records to `credit_ledger` with running balance updates.
- [x] Apply credit spend atomically during order finalization.
- [x] Implement repurchase rule:
- [x] If needed-field profile matches active subscription for same service, extend existing subscription end date.
- [x] If profile differs, create new parallel subscription record.
- [x] Schedule/update reminder notifications after each activation/extension.

## Phase 9 - Notification System (QStash + State Tracking)

- [x] Implement notification creation service with DB row state `pending`.
- [x] Publish scheduled jobs to QStash with send-at time and notification id payload.
- [x] Verify QStash signature in `/api/qstash/dispatch`.
- [x] On dispatch, load pending notification, send Telegram message, and mark `sent`.
- [x] Record `failed` with retry metadata when delivery fails.
- [x] Implement automatic scheduling points:
- [x] At activation: schedule reminder for `expiry - 3 days` if still in future.
- [x] At activation: schedule ended notification at expiry timestamp.
- [x] Ensure idempotency keys prevent duplicate sends.
- [x] Implement admin manual scheduling with immediate-send shortcut that bypasses scheduling but still stores notification record.

## Phase 10 - Security and Abuse Resistance

- [x] Enforce Telegram webhook secret token header check before parsing update body.
- [x] Reject non-POST and invalid content-type requests.
- [x] Implement Upstash rate limiting:
- [x] Global per-user update throttle.
- [x] Strict proof-upload throttle.
- [x] Strict discount-attempt throttle.
- [x] Admin action throttle.
- [x] Add anti-replay/idempotency for callback and admin action buttons.
- [x] Add authorization guards to ensure only admin can execute admin callbacks.
- [x] Add audit logging for create/edit/delete/approve/dismiss/discount-change/notification-send.
- [x] Redact sensitive fields from logs and Sentry payloads.

## Phase 11 - Observability and Error Handling

- [x] Implement structured logs with `pino` including request id, update id, user id, order id.
- [x] Add centralized error boundary for bot and HTTP routes.
- [x] Integrate Sentry capture for unhandled exceptions and rejected promises.
- [x] Add domain error classes for validation, authorization, state conflict, external API failure.
- [x] Ensure user-facing messages stay friendly and localized while internal logs retain diagnostics.
- [x] Add health endpoint checks for DB and Redis connectivity.

## Phase 12 - Testing Strategy (Vitest + Bot Update Harness)

- [x] Create unit tests for env validation and config defaults.
- [x] Create unit tests for price calculation (discount first then credit), rounding, and zero-payable branch.
- [x] Create unit tests for discount rule evaluator (all advanced constraints).
- [x] Create unit tests for referral reward calculation and ledger updates.
- [x] Create unit tests for image proof validator and order state gate.
- [x] Create integration tests for DB transactions:
- [x] Approve order creates/extends subscription correctly.
- [x] Dismiss order requires explanation and notifies user.
- [x] Repurchase same-fields extends; different-fields creates parallel subscription.
- [x] Create integration tests for notification lifecycle (`pending -> sent`, retry/failure path).
- [x] Create webhook tests:
- [x] Reject missing/invalid Telegram secret.
- [x] Reject invalid QStash signature.
- [x] Accept valid signed requests.
- [x] Build small bot-update harness to feed synthetic Telegram updates for happy-path and edge-path conversation testing.
- [x] Enforce coverage threshold `>=80%` lines/functions/branches/statements.
- [x] Add CI pipeline for `typecheck + lint + test + coverage`.

## Phase 13 - Deployment, Ops, and Runbooks

- [x] Add `vercel.json` routing and runtime config for API functions.
- [x] Add deploy-time script to set Telegram webhook URL + secret.
- [x] Document required Vercel env vars and rotation procedure for secrets.
- [x] Add operational runbooks:
- [x] Payment dispute resolution via audit logs.
- [x] Re-sending failed notifications.
- [x] Manual credit adjustment protocol.
- [x] Add migration run order for production deploys.
- [x] Add rollback guidance for bot deploy and DB migration issues.
- [ ] Validate production readiness checklist before launch.

## Phase 14 - Scope-Gap Closure Tasks

- [x] Route all bot notifications through the QStash-backed notification system (no direct lifecycle notification sends):
- [x] Replace direct `sendMessage` order lifecycle sends (order queued, approved, dismissed) with notification records + dispatch path.
- [x] Add dedicated notification message keys/payload contracts for order lifecycle events and keep localization support.
- [x] Ensure every notification entry transitions via `pending -> sent|failed|cancelled` and is auditable.
- [x] Add tests for order lifecycle notification state transitions and idempotency.
- [x] Complete i18n coverage for admin and user-facing UI/flow text:
- [x] Replace hardcoded English labels/prompts/buttons in menus, conversations, and handlers with `ctx.t(...)`.
- [x] Add missing keys in both `locales/en.ftl` and `locales/fa.ftl` for all newly localized texts.
- [x] Keep callback/button wording fully localized while preserving callback payload stability.
- [x] Add/update tests to verify locale output for key admin/user flows.
- [x] Expand discount admin customization to full scope:
- [x] Support editing `code`, `type`, and `service scope` in addition to currently editable fields.
- [x] Add validation and conflict handling for code updates (normalization + uniqueness failures).
- [x] Support service-scope replacement/clearing in edit flow and persist through repository transaction.
- [x] Add tests for discount edit scenarios, especially service-scope updates and invalid transitions.
- [x] Implement explicit subscription expiry lifecycle management:
- [x] Add a deterministic expiry updater to mark subscriptions as `expired` when end date is reached.
- [x] Run expiry updates at reliable execution points (notification dispatch and/or scheduled reconciliation job).
- [x] Ensure `/my_services` reflects real-time active/expired status after reconciliation.
- [x] Add tests covering transition from active to expired and related user-visible outputs.
- [x] Align callback contract implementation with declared v1 callback set:
- [x] Implement handlers for declared callbacks (`buy:confirm`, `buy:edit`, `buy:cancel`, `discount:apply`, `notify:dismiss`) or remove unused contracts.
- [x] Add callback-level authorization, state checks, and idempotency for any newly activated callbacks.
- [x] Add tests for valid/invalid callback payload handling and unknown callback fallbacks.
- [x] Add runtime input validation with Zod v4 for multi-step admin/user conversations:
- [x] Validate service/discount/notification conversation payloads via schemas instead of ad-hoc parsing only.
- [x] Add strict date-time validation for admin notification scheduling input and reject invalid dates safely.
- [x] Normalize and validate numeric inputs (price, limits, duration, percentage) with clear localized error responses.
- [x] Add tests for schema validation failures and recovery loops in conversations.
- [ ] Complete production readiness and launch sign-off:
- [ ] Run `pnpm ops:readiness` successfully in target environment and archive the result.
- [ ] Verify staging webhook security + QStash signature path + health endpoint checks.
- [ ] Execute manual E2E smoke flow (`buy -> proof -> admin done -> reminder`) and record evidence.
- [ ] Confirm Sentry, logs, runbooks, and on-call procedures are validated before launch.

## Test Cases and Scenarios (Acceptance)

- [x] User can browse services, open detail, and see price in configured unit.
- [x] New buyer completes needed-field collection with edit loop and summary confirmation.
- [x] Returning buyer reuses profile; editing fields changes profile and repurchase behavior.
- [x] Discount code success and all major rejection reasons are correctly surfaced.
- [x] Credit application reduces payable; zero-payable flow skips proof and still requires admin done.
- [x] Proof upload accepts only expected image types and only in `awaiting_proof`.
- [x] Admin receives full order context including user info, discount info, and provided fields.
- [x] Admin done activates service and sends user activation message.
- [x] Admin dismiss forces explanation + final confirmation and sends explanation to user.
- [x] Reminder fires 3 days before expiry and ended notification fires on expiry.
- [x] Referral reward posts only after activation and updates inviter wallet.
- [x] Webhook endpoints reject unsigned/invalid requests.
- [x] Rate limiting blocks proof spam and discount brute force attempts.
- [x] Audit logs capture all admin state-changing operations.

## Definition of Done

- [ ] All phases completed with passing CI.
- [ ] Database migrated and seed sanity checks pass.
- [ ] Webhooks configured and signature checks verified in staging.
- [ ] End-to-end manual smoke test for buy -> proof -> admin done -> reminders passes.
- [ ] Launch checklist signed off with logging, Sentry, and runbooks enabled.
