welcome = Welcome to {$botName}.
main-menu = Main Menu
menu-services = Services
menu-my-services = My Services
menu-wallet = Wallet
menu-referral = Referral
menu-channel = Official Channel
menu-admin = Admin
services-title = Available services:
services-empty = No active services found.
service-details =
  {$title}
  Price: {$price} {$unit}
  Duration: {$duration} days
  {$description}
service-notes-title = Notes:
buy-button = Buy
buy-start = Starting purchase flow...
buy-enter-field = Please enter {$field}:
buy-confirm-values = Confirm your values:
buy-confirm-ok = Are these values correct?
buy-edit-ask = Send the field name you want to edit, or type /done.
buy-discount-ask = Send discount code or type SKIP.
buy-discount-applied = Discount applied: {$amount} {$unit}
buy-discount-invalid = Discount rejected: {$reason}
discount-reason-not-found = code not found
discount-reason-inactive = code is inactive
discount-reason-not-started = code is not active yet
discount-reason-expired = code has expired
discount-reason-service-scope = code is not valid for this service
discount-reason-min-order = order does not meet minimum amount
discount-reason-total-usage-limit = code reached total usage limit
discount-reason-user-usage-limit = you reached per-user usage limit
discount-reason-first-purchase-only = code is only for first purchase
buy-pricing =
  Base: {$base} {$unit}
  Discount: {$discount} {$unit}
  Credit used: {$credit} {$unit}
  Payable: {$payable} {$unit}
buy-proof-required = Send payment proof image for card: {$card}
buy-proof-invalid = Invalid proof. Send image/jpeg, image/png, or image/webp.
buy-proof-too-large = Proof image is too large.
buy-proof-saved = Proof received. Waiting for admin review.
buy-zero-payable = Payable is zero. Sent to admin for activation.
order-sent-admin = Your purchase request is now under admin review.
my-services-title = Your subscriptions
my-services-empty = You have no subscriptions yet.
wallet-balance = Wallet credit: {$balance} {$unit}
referral-link = Invite link:
referral-balance = Your credit balance: {$balance} {$unit}
admin-denied = Admin only command.
admin-menu = Admin Panel
admin-menu-pending-orders = Pending Orders
admin-menu-create-service = Create Service
admin-menu-edit-service = Edit Service
admin-menu-deactivate-service = Deactivate Service
admin-menu-create-discount = Create Discount
admin-menu-edit-discount = Edit Discount
admin-menu-deactivate-discount = Deactivate Discount
admin-menu-notifications = Notifications
admin-menu-audit = Audit
admin-pending-title = Pending orders:
admin-pending-empty = No pending orders.
admin-action-view = View
admin-action-done = Done
admin-action-dismiss = Dismiss
admin-action-contact = Contact
admin-audit-empty = No audit logs yet.
common-active = active
common-inactive = inactive
common-none = -
action-cancelled = Cancelled.
admin-contact-user-info =
  User info:
  Telegram ID: {$telegramId}
  Username: {$username}
  Name: {$name}
  Direct: {$link}
admin-order-extra =
  Username: {$username}
  Direct: {$link}
  Discount code: {$discountCode}
  Proof: {$proof}
admin-proof-summary = {$mime} | {$size} bytes
admin-proof-caption = Proof for order {$orderId}
admin-order-card =
  Order {$orderId}
  User: {$user}
  Service: {$service}
  Base: {$base} {$unit}
  Discount: {$discount} {$unit}
  Credit: {$credit} {$unit}
  Payable: {$payable} {$unit}
  Fields:
  {$fields}
admin-order-approved-user = Your service is active now. Expiry: {$expiry}
admin-order-dismissed-user = Your order was dismissed. Reason: {$reason}
admin-dismiss-reason-ask = Send dismissal reason.
admin-dismiss-confirm = Are you sure to dismiss this order with this reason?
confirm-yes-prompt = Type YES to confirm.
dismiss-cancelled = Dismiss cancelled.
admin-dismiss-confirmed = Order dismissed and user notified.
admin-done-confirmed = Order approved and user notified.
service-admin-create-title-prompt = Service title:
service-admin-create-price-prompt = Price (numeric):
service-admin-create-description-prompt = Description (optional, send - to skip):
service-admin-create-notes-prompt = Notes (comma separated):
service-admin-create-fields-prompt = Needed fields (comma separated):
service-admin-create-duration-prompt = Duration in days (1..255):
service-admin-create-failed = Failed to create service.
service-admin-created = Service created: {$title}
service-admin-edit-empty = No services to edit.
service-admin-service-row = {$id} | {$title} | active={$isActive}
service-admin-edit-id-prompt = Send service id:
service-admin-edit-field-prompt = Field to edit (title|price|description|notes|neededFields|durationDays):
service-admin-edit-value-prompt = New value:
service-admin-edit-confirm-preview = About to update {$field} to "{$value}". Type YES to confirm.
service-admin-edit-confirm-prompt = Confirm update:
service-admin-updated = Service updated: {$title}
service-admin-deactivate-empty = No services to deactivate.
service-admin-deactivate-id-prompt = Send service id to deactivate:
service-admin-deactivate-confirm-prompt = Type YES to confirm:
service-admin-deactivated = Service deactivated: {$title}
service-admin-not-found = Service not found.
service-admin-error-title-min = Title must be at least 2 characters.
service-admin-error-price-format = Invalid price format.
service-admin-error-duration-range = Duration must be an integer between 1 and 255.
service-admin-error-field = Invalid field.
discount-admin-create-code-prompt = Code:
discount-admin-create-type-prompt = Type (percent/fixed):
discount-admin-create-amount-prompt = Amount:
discount-admin-create-min-order-prompt = Min order amount (or -):
discount-admin-create-max-discount-prompt = Max discount amount (or -):
discount-admin-create-starts-at-prompt = Starts at ISO datetime (or -):
discount-admin-create-ends-at-prompt = Ends at ISO datetime (or -):
discount-admin-create-total-usage-prompt = Total usage limit (or -):
discount-admin-create-per-user-usage-prompt = Per-user usage limit (or -):
discount-admin-create-first-purchase-prompt = First purchase only? (yes/no):
discount-admin-create-service-scope-prompt = Service scope (comma-separated IDs or -):
discount-admin-service-scope-help =
  Services:
  {$services}
discount-admin-service-row = {$id} | {$title}
discount-admin-service-row-empty = (No services found)
discount-admin-discount-row = {$id} | {$code} | active={$isActive}
discount-admin-created = Discount created: {$code}
discount-admin-empty = No discount codes yet.
discount-admin-edit-id-prompt = Discount id:
discount-admin-edit-field-prompt = Field (code|type|amount|minOrderAmount|maxDiscountAmount|startsAt|endsAt|totalUsageLimit|perUserUsageLimit|firstPurchaseOnly|isActive|serviceScope):
discount-admin-edit-value-prompt = Value:
discount-admin-updated = Discount updated: {$code}
discount-admin-deactivate-id-prompt = Discount id to deactivate:
discount-admin-deactivate-confirm-prompt = Type YES to confirm:
discount-admin-deactivated = Discount deactivated: {$code}
discount-admin-not-found = Discount not found.
discount-admin-error-field = Invalid field.
discount-admin-error-code = Discount code cannot be empty.
discount-admin-error-type = Invalid type.
discount-admin-error-money = Invalid amount format.
discount-admin-error-datetime = Invalid datetime. Use ISO datetime with timezone (example: 2026-03-01T10:20:30Z).
discount-admin-error-usage-limit = Usage limit must be a positive integer.
discount-admin-error-code-exists = Discount code already exists.
notification-created = Notification scheduled.
notification-sent = Notification sent.
notification-dismissed = Notification dismissed.
notification-dismiss-not-pending = Notification is already processed.
notification-dismiss-not-found = Notification was not found.
notification-admin-audience-prompt = Audience (user|all|service_subscribers):
notification-admin-invalid-audience = Invalid audience.
notification-admin-target-user-prompt = Target user telegram id:
notification-admin-user-not-found = User not found.
notification-admin-service-id-prompt = Service id:
notification-admin-service-list-empty = No services found.
notification-admin-service-row = {$id} | {$title}
notification-admin-text-prompt = Notification text:
notification-admin-send-at-prompt = Send at (ISO datetime with timezone, e.g. 2026-03-01T10:20:30Z) or NOW:
notification-admin-invalid-datetime = Invalid datetime. Use ISO format with timezone or send NOW.
notification-subscription-reminder = Reminder: your {$serviceTitle} subscription expires in 3 days.
notification-subscription-ended = Your {$serviceTitle} subscription has ended.
notification-order-queued-admin = New order waiting review: {$orderId}
notification-order-approved-user = Your service is active now. Expiry: {$expiry}
notification-order-dismissed-user = Your order was dismissed. Reason: {$reason}
my-services-status-active = active
my-services-status-expired = expired
processing = Processing...
error-generic = Something went wrong. Please try again.
rate-limit = Too many requests. Please slow down.
action-already-processed = This action was already processed.
unknown-command = Unknown command.
unknown-action = Unknown action.
