welcome = به {$botName} خوش آمدید.
main-menu = منوی اصلی
menu-services = سرویس ها
menu-my-services = سرویس های من
menu-wallet = کیف پول
menu-referral = دعوت دوستان
menu-channel = کانال رسمی
menu-admin = ادمین
services-title = لیست سرویس های فعال:
services-empty = سرویس فعالی پیدا نشد.
service-details =
  {$title}
  قیمت: {$price} {$unit}
  مدت: {$duration} روز
  {$description}
service-notes-title = نکات:
buy-button = خرید
buy-start = فرایند خرید شروع شد.
buy-enter-field = لطفا {$field} را وارد کنید:
buy-confirm-values = مقادیر وارد شده:
buy-confirm-ok = آیا مقادیر درست هستند؟
buy-edit-ask = نام فیلد برای ویرایش را بفرستید یا /done بزنید.
buy-discount-ask = کد تخفیف را بفرستید یا SKIP بنویسید.
buy-discount-applied = تخفیف اعمال شد: {$amount} {$unit}
buy-discount-invalid = کد تخفیف نامعتبر است: {$reason}
discount-reason-not-found = کد تخفیف پیدا نشد
discount-reason-inactive = کد تخفیف غیرفعال است
discount-reason-not-started = زمان فعال شدن کد تخفیف نرسیده است
discount-reason-expired = کد تخفیف منقضی شده است
discount-reason-service-scope = این کد برای این سرویس قابل استفاده نیست
discount-reason-min-order = مبلغ سفارش به حداقل لازم نرسیده است
discount-reason-total-usage-limit = سقف استفاده کلی این کد تکمیل شده است
discount-reason-user-usage-limit = سقف استفاده شما از این کد تکمیل شده است
discount-reason-first-purchase-only = این کد فقط برای خرید اول است
buy-pricing =
  مبلغ پایه: {$base} {$unit}
  تخفیف: {$discount} {$unit}
  اعتبار مصرفی: {$credit} {$unit}
  قابل پرداخت: {$payable} {$unit}
buy-proof-required = تصویر رسید پرداخت کارت {$card} را بفرستید.
buy-proof-invalid = رسید نامعتبر است. فقط image/jpeg یا image/png یا image/webp.
buy-proof-too-large = فایل رسید خیلی بزرگ است.
buy-proof-saved = رسید ثبت شد. منتظر تایید ادمین باشید.
buy-zero-payable = مبلغ قابل پرداخت صفر شد. درخواست برای تایید ادمین ارسال شد.
order-sent-admin = درخواست خرید شما برای ادمین ارسال شد.
my-services-title = اشتراک های شما
my-services-empty = هنوز اشتراکی ندارید.
wallet-balance = اعتبار کیف پول: {$balance} {$unit}
referral-link = لینک دعوت شما:
referral-balance = اعتبار فعلی شما: {$balance} {$unit}
admin-denied = این بخش فقط برای ادمین است.
admin-menu = پنل ادمین
admin-menu-pending-orders = سفارش های در انتظار
admin-menu-create-service = ساخت سرویس
admin-menu-edit-service = ویرایش سرویس
admin-menu-deactivate-service = غیرفعال کردن سرویس
admin-menu-create-discount = ساخت تخفیف
admin-menu-edit-discount = ویرایش تخفیف
admin-menu-deactivate-discount = غیرفعال کردن تخفیف
admin-menu-notifications = اعلان ها
admin-menu-audit = گزارش عملیات
admin-pending-title = سفارش های در انتظار:
admin-pending-empty = سفارش در انتظار وجود ندارد.
admin-action-view = مشاهده
admin-action-done = انجام شد
admin-action-dismiss = رد
admin-action-contact = ارتباط
admin-audit-empty = هنوز گزارشی ثبت نشده است.
common-active = فعال
common-inactive = غیرفعال
common-none = -
action-cancelled = لغو شد.
admin-contact-user-info =
  اطلاعات کاربر:
  شناسه تلگرام: {$telegramId}
  نام کاربری: {$username}
  نام: {$name}
  لینک مستقیم: {$link}
admin-order-extra =
  نام کاربری: {$username}
  لینک مستقیم: {$link}
  کد تخفیف: {$discountCode}
  رسید: {$proof}
admin-proof-summary = {$mime} | {$size} بایت
admin-proof-caption = رسید سفارش {$orderId}
admin-order-card =
  سفارش {$orderId}
  کاربر: {$user}
  سرویس: {$service}
  مبلغ پایه: {$base} {$unit}
  تخفیف: {$discount} {$unit}
  اعتبار: {$credit} {$unit}
  قابل پرداخت: {$payable} {$unit}
  فیلدها:
  {$fields}
admin-order-approved-user = سرویس شما فعال شد. تاریخ پایان: {$expiry}
admin-order-dismissed-user = سفارش شما رد شد. دلیل: {$reason}
admin-dismiss-reason-ask = دلیل رد سفارش را بفرستید.
admin-dismiss-confirm = آیا از رد سفارش مطمئن هستید؟
confirm-yes-prompt = برای تایید YES بنویسید.
dismiss-cancelled = رد سفارش لغو شد.
admin-dismiss-confirmed = سفارش رد شد و کاربر مطلع شد.
admin-done-confirmed = سفارش تایید شد و کاربر مطلع شد.
service-admin-create-title-prompt = عنوان سرویس:
service-admin-create-price-prompt = قیمت (عددی):
service-admin-create-description-prompt = توضیحات (اختیاری، برای رد شدن - بفرستید):
service-admin-create-notes-prompt = نکات (با کاما جدا کنید):
service-admin-create-fields-prompt = فیلدهای موردنیاز (با کاما جدا کنید):
service-admin-create-duration-prompt = مدت به روز (1..255):
service-admin-create-failed = ساخت سرویس ناموفق بود.
service-admin-created = سرویس ساخته شد: {$title}
service-admin-edit-empty = سرویسی برای ویرایش وجود ندارد.
service-admin-service-row = {$id} | {$title} | فعال={$isActive}
service-admin-edit-id-prompt = شناسه سرویس را بفرستید:
service-admin-edit-field-prompt = فیلد برای ویرایش (title|price|description|notes|neededFields|durationDays):
service-admin-edit-value-prompt = مقدار جدید:
service-admin-edit-confirm-preview = قرار است {$field} به "{$value}" تغییر کند. برای تایید YES بنویسید.
service-admin-edit-confirm-prompt = تایید ویرایش:
service-admin-updated = سرویس ویرایش شد: {$title}
service-admin-deactivate-empty = سرویسی برای غیرفعال‌سازی وجود ندارد.
service-admin-deactivate-id-prompt = شناسه سرویس برای غیرفعال‌سازی را بفرستید:
service-admin-deactivate-confirm-prompt = برای تایید YES بنویسید:
service-admin-deactivated = سرویس غیرفعال شد: {$title}
service-admin-not-found = سرویس پیدا نشد.
service-admin-error-title-min = عنوان باید حداقل 2 کاراکتر باشد.
service-admin-error-price-format = فرمت قیمت نامعتبر است.
service-admin-error-duration-range = مدت باید عدد صحیح بین 1 تا 255 باشد.
service-admin-error-field = فیلد نامعتبر است.
discount-admin-create-code-prompt = کد:
discount-admin-create-type-prompt = نوع (percent/fixed):
discount-admin-create-amount-prompt = مقدار:
discount-admin-create-min-order-prompt = حداقل مبلغ سفارش (یا -):
discount-admin-create-max-discount-prompt = سقف تخفیف (یا -):
discount-admin-create-starts-at-prompt = زمان شروع ISO (یا -):
discount-admin-create-ends-at-prompt = زمان پایان ISO (یا -):
discount-admin-create-total-usage-prompt = سقف استفاده کلی (یا -):
discount-admin-create-per-user-usage-prompt = سقف استفاده هر کاربر (یا -):
discount-admin-create-first-purchase-prompt = فقط خرید اول؟ (yes/no):
discount-admin-create-service-scope-prompt = دامنه سرویس (شناسه‌ها با کاما یا -):
discount-admin-service-scope-help =
  سرویس‌ها:
  {$services}
discount-admin-service-row = {$id} | {$title}
discount-admin-service-row-empty = (سرویسی پیدا نشد)
discount-admin-discount-row = {$id} | {$code} | فعال={$isActive}
discount-admin-created = کد تخفیف ساخته شد: {$code}
discount-admin-empty = هنوز کد تخفیفی وجود ندارد.
discount-admin-edit-id-prompt = شناسه تخفیف:
discount-admin-edit-field-prompt = فیلد (code|type|amount|minOrderAmount|maxDiscountAmount|startsAt|endsAt|totalUsageLimit|perUserUsageLimit|firstPurchaseOnly|isActive|serviceScope):
discount-admin-edit-value-prompt = مقدار:
discount-admin-updated = کد تخفیف ویرایش شد: {$code}
discount-admin-deactivate-id-prompt = شناسه تخفیف برای غیرفعال‌سازی:
discount-admin-deactivate-confirm-prompt = برای تایید YES بنویسید:
discount-admin-deactivated = کد تخفیف غیرفعال شد: {$code}
discount-admin-not-found = کد تخفیف پیدا نشد.
discount-admin-error-field = فیلد نامعتبر است.
discount-admin-error-code = کد تخفیف نمی‌تواند خالی باشد.
discount-admin-error-type = نوع نامعتبر است.
discount-admin-error-money = فرمت مبلغ نامعتبر است.
discount-admin-error-datetime = زمان نامعتبر است. زمان ISO با منطقه زمانی بفرستید (مثل 2026-03-01T10:20:30Z).
discount-admin-error-usage-limit = سقف استفاده باید عدد صحیح مثبت باشد.
discount-admin-error-code-exists = این کد تخفیف قبلا ثبت شده است.
notification-created = اعلان زمان بندی شد.
notification-sent = اعلان ارسال شد.
notification-dismissed = اعلان بسته شد.
notification-dismiss-not-pending = اعلان قبلا پردازش شده است.
notification-dismiss-not-found = اعلان پیدا نشد.
notification-admin-audience-prompt = مخاطب (user|all|service_subscribers):
notification-admin-invalid-audience = مخاطب نامعتبر است.
notification-admin-target-user-prompt = شناسه تلگرام کاربر مقصد:
notification-admin-user-not-found = کاربر پیدا نشد.
notification-admin-service-id-prompt = شناسه سرویس:
notification-admin-service-list-empty = سرویسی پیدا نشد.
notification-admin-service-row = {$id} | {$title}
notification-admin-text-prompt = متن اعلان:
notification-admin-send-at-prompt = زمان ارسال (ISO با منطقه زمانی مثل 2026-03-01T10:20:30Z) یا NOW:
notification-admin-invalid-datetime = زمان نامعتبر است. فرمت ISO با منطقه زمانی بفرستید یا NOW بنویسید.
notification-subscription-reminder = یادآوری: اشتراک {$serviceTitle} شما 3 روز دیگر تمام می‌شود.
notification-subscription-ended = اشتراک {$serviceTitle} شما به پایان رسید.
notification-order-queued-admin = سفارش جدید در انتظار بررسی: {$orderId}
notification-order-approved-user = سرویس شما فعال شد. تاریخ پایان: {$expiry}
notification-order-dismissed-user = سفارش شما رد شد. دلیل: {$reason}
my-services-status-active = فعال
my-services-status-expired = منقضی
processing = در حال پردازش...
error-generic = خطایی رخ داد. دوباره تلاش کنید.
rate-limit = درخواست زیاد است. کمی صبر کنید.
action-already-processed = این عملیات قبلا انجام شده است.
unknown-command = دستور نامعتبر است.
unknown-action = عملیات نامعتبر است.
