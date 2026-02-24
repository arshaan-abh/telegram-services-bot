# Payment Dispute Runbook

1. Locate the order id from user message.
2. Query `audit_logs` for all `order.*` actions on that id.
3. Review `orders` record (`proof_file_id`, `dismiss_reason`, `admin_action_by`).
4. Re-check provided proof and payment metadata.
5. If correction required:
   - send manual message to user,
   - add compensating `credit_ledger` entry,
   - add `audit_logs` entry with `action=order.dispute_resolved`.
6. Document final outcome in internal tracker.
