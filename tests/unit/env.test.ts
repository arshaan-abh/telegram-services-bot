import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../../src/config/env.js";

describe("env validation", () => {
  it("fails when required env vars are missing", () => {
    const parsed = parseEnvironment({});
    expect(parsed.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const parsed = parseEnvironment({
      BOT_TOKEN: "123:token",
      TELEGRAM_WEBHOOK_SECRET: "secret_1234567890123456",
      ADMIN_TELEGRAM_ID: "123",
      BOT_NAME: "TestBot",
      CARD_NUMBER: "4111111111111111",
      REFERRAL_PERCENT: "10",
      DATABASE_URL: "https://db.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      QSTASH_TOKEN: "token",
      QSTASH_CURRENT_SIGNING_KEY: "current",
      QSTASH_NEXT_SIGNING_KEY: "next",
      APP_BASE_URL: "https://example.com",
      MAIN_CHANNEL_URL: "https://t.me/example",
      PRICE_UNIT: "dollar",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.BOT_LANGUAGE).toBe("en");
    expect(parsed.data.APP_TIMEZONE).toBe("UTC");
    expect(parsed.data.PRICE_DECIMALS).toBe(2);
    expect(parsed.data.MAX_PROOF_SIZE_MB).toBe(5);
  });

  it("rejects invalid timezone and referral percent bounds", () => {
    const parsed = parseEnvironment({
      BOT_TOKEN: "123:token",
      TELEGRAM_WEBHOOK_SECRET: "secret_1234567890123456",
      ADMIN_TELEGRAM_ID: "123",
      BOT_NAME: "TestBot",
      CARD_NUMBER: "4111111111111111",
      REFERRAL_PERCENT: "120",
      DATABASE_URL: "https://db.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      QSTASH_TOKEN: "token",
      QSTASH_CURRENT_SIGNING_KEY: "current",
      QSTASH_NEXT_SIGNING_KEY: "next",
      APP_BASE_URL: "https://example.com",
      MAIN_CHANNEL_URL: "https://t.me/example",
      APP_TIMEZONE: "Not/AZone",
      PRICE_UNIT: "dollar",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts explicit optional values and bigint-safe admin id", () => {
    const parsed = parseEnvironment({
      NODE_ENV: "production",
      BOT_TOKEN: "123:token",
      TELEGRAM_WEBHOOK_SECRET: "secret_1234567890123456",
      ADMIN_TELEGRAM_ID: "9007199254740991",
      BOT_NAME: "TestBot",
      CARD_NUMBER: "4111111111111111",
      REFERRAL_PERCENT: "7.5",
      DATABASE_URL: "https://db.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      QSTASH_TOKEN: "token",
      QSTASH_CURRENT_SIGNING_KEY: "current",
      QSTASH_NEXT_SIGNING_KEY: "next",
      APP_BASE_URL: "https://example.com",
      MAIN_CHANNEL_URL: "https://t.me/example",
      BOT_LANGUAGE: "fa",
      APP_TIMEZONE: "UTC",
      PRICE_DECIMALS: "4",
      MAX_PROOF_SIZE_MB: "10",
      LOG_LEVEL: "debug",
      INTERNAL_WEBHOOK_SETUP_TOKEN: "1234567890abcdef",
      PRICE_UNIT: "rial",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.NODE_ENV).toBe("production");
    expect(parsed.data.BOT_LANGUAGE).toBe("fa");
    expect(parsed.data.PRICE_DECIMALS).toBe(4);
    expect(parsed.data.MAX_PROOF_SIZE_MB).toBe(10);
    expect(parsed.data.LOG_LEVEL).toBe("debug");
    expect(parsed.data.INTERNAL_WEBHOOK_SETUP_TOKEN).toBe("1234567890abcdef");
  });

  it("treats empty optional Sentry DSN as unset", () => {
    const parsed = parseEnvironment({
      BOT_TOKEN: "123:token",
      TELEGRAM_WEBHOOK_SECRET: "secret_1234567890123456",
      ADMIN_TELEGRAM_ID: "123",
      BOT_NAME: "TestBot",
      CARD_NUMBER: "4111111111111111",
      REFERRAL_PERCENT: "10",
      DATABASE_URL: "https://db.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      QSTASH_TOKEN: "token",
      QSTASH_CURRENT_SIGNING_KEY: "current",
      QSTASH_NEXT_SIGNING_KEY: "next",
      APP_BASE_URL: "https://example.com",
      MAIN_CHANNEL_URL: "https://t.me/example",
      PRICE_UNIT: "dollar",
      SENTRY_DSN: "",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.SENTRY_DSN).toBeUndefined();
  });

  it("treats empty optional internal webhook setup token as unset", () => {
    const parsed = parseEnvironment({
      BOT_TOKEN: "123:token",
      TELEGRAM_WEBHOOK_SECRET: "secret_1234567890123456",
      ADMIN_TELEGRAM_ID: "123",
      BOT_NAME: "TestBot",
      CARD_NUMBER: "4111111111111111",
      REFERRAL_PERCENT: "10",
      DATABASE_URL: "https://db.example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
      QSTASH_TOKEN: "token",
      QSTASH_CURRENT_SIGNING_KEY: "current",
      QSTASH_NEXT_SIGNING_KEY: "next",
      APP_BASE_URL: "https://example.com",
      MAIN_CHANNEL_URL: "https://t.me/example",
      PRICE_UNIT: "dollar",
      INTERNAL_WEBHOOK_SETUP_TOKEN: "",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.INTERNAL_WEBHOOK_SETUP_TOKEN).toBeUndefined();
  });
});
