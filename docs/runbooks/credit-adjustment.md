# Manual Credit Adjustment Runbook

1. Verify user identity (`users.telegram_id`).
2. Read latest wallet balance from `credit_ledger`.
3. Compute new balance after adjustment.
4. Insert `credit_ledger` row:
   - `type=admin_adjustment`
   - signed `amount`
   - `balance_after`
   - `created_by=<admin telegram id>`
   - `note` with reason
5. Add `audit_logs` record with action `credit.adjust`.
6. Notify user with adjustment summary.
