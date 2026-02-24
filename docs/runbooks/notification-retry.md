# Notification Retry Runbook

1. Find failed notifications:
   - `select * from notifications where state = 'failed' order by failed_at desc;`
2. Inspect `failure_reason`.
3. If transient error, create a replacement notification row with a new `idempotency_key`.
4. Publish a new QStash message pointing to `/api/qstash/dispatch`.
5. Confirm state transitions to `sent`.
6. Log manual retry in `audit_logs` as `notification.retry`.
