# Deployment Runbook

## Migration Run Order

1. Deploy code to preview environment.
2. Run `pnpm db:migrate` against preview database.
3. Verify preview smoke flows (`/api/health`, webhook request, one notification dispatch).
4. Promote release to production.
5. Run `pnpm db:migrate` against production database.
6. Run `pnpm db:seed` only when seed changes are explicitly intended for production.
7. Execute webhook setup (`pnpm set:webhook` or `/api/internal/set-webhook`).

## Rollback Guidance

1. If application deploy is bad but schema is compatible:
   - Roll back Vercel deployment to previous stable release.
2. If migration introduces an issue:
   - Stop bot traffic (disable webhook temporarily).
   - Apply compensating migration (preferred) instead of destructive rollback.
   - Redeploy last stable app version after schema is stable.
3. Re-enable webhook and validate with a smoke test.

## Production Readiness Checklist

- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm test` are green in CI.
- [ ] `pnpm db:migrate` completed successfully in target environment.
- [ ] Required Vercel environment variables are present.
- [ ] Webhook endpoint is configured with valid secret token.
- [ ] QStash signatures verify successfully in `/api/qstash/dispatch`.
- [ ] Sentry DSN configured for production and errors visible.
- [ ] Health endpoint reports DB and Redis as `up`.
- [ ] Runbooks are available to on-call responders.
