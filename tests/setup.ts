process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.BOT_TOKEN = process.env.BOT_TOKEN ?? "123456:TEST_TOKEN";
process.env.TELEGRAM_WEBHOOK_SECRET =
  process.env.TELEGRAM_WEBHOOK_SECRET ?? "test_webhook_secret_123456";
process.env.ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID ?? "123456789";
process.env.BOT_NAME = process.env.BOT_NAME ?? "TestBot";
process.env.PRICE_UNIT = process.env.PRICE_UNIT ?? "dollar";
process.env.CARD_NUMBER = process.env.CARD_NUMBER ?? "4111111111111111";
process.env.REFERRAL_PERCENT = process.env.REFERRAL_PERCENT ?? "10";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/telegram_services_bot";
process.env.UPSTASH_REDIS_REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? "https://redis.example.com";
process.env.UPSTASH_REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? "test_redis_token";
process.env.QSTASH_TOKEN = process.env.QSTASH_TOKEN ?? "test_qstash_token";
process.env.QSTASH_CURRENT_SIGNING_KEY =
  process.env.QSTASH_CURRENT_SIGNING_KEY ?? "test_current_signing_key";
process.env.QSTASH_NEXT_SIGNING_KEY =
  process.env.QSTASH_NEXT_SIGNING_KEY ?? "test_next_signing_key";
process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "https://example.com";
process.env.MAIN_CHANNEL_URL =
  process.env.MAIN_CHANNEL_URL ?? "https://t.me/example";
process.env.BOT_LANGUAGE = process.env.BOT_LANGUAGE ?? "en";
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? "UTC";
process.env.PRICE_DECIMALS = process.env.PRICE_DECIMALS ?? "2";
process.env.MAX_PROOF_SIZE_MB = process.env.MAX_PROOF_SIZE_MB ?? "5";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
