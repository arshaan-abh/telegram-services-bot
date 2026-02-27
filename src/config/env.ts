import { z } from "zod";

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  return value;
}

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

const optionalMinLengthString = (min: number) =>
  z.preprocess(emptyStringToUndefined, z.string().min(min).optional());

const bigintString = z
  .string()
  .regex(/^\d+$/, "must be a positive integer")
  .refine((value) => {
    try {
      return BigInt(value) > 0n;
    } catch {
      return false;
    }
  }, "must be bigint-safe numeric string");

const timezoneSchema = z
  .string()
  .default("UTC")
  .refine(
    (value) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "must be a valid IANA timezone" },
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .min(16, "TELEGRAM_WEBHOOK_SECRET is required"),
  ADMIN_TELEGRAM_ID: bigintString,
  BOT_NAME: z.string().min(3),
  PRICE_UNIT: z.string().min(1).default("dollar"),
  CARD_NUMBER: z.string().min(8),
  REFERRAL_PERCENT: z.coerce.number().min(0).max(100),
  DATABASE_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  MAIN_CHANNEL_URL: z.string().url(),
  BOT_LANGUAGE: z.enum(["en", "fa"]).default("en"),
  APP_TIMEZONE: timezoneSchema,
  PRICE_DECIMALS: z.coerce.number().int().min(0).max(6).default(2),
  MAX_PROOF_SIZE_MB: z.coerce.number().int().min(1).max(50).default(5),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SENTRY_DSN: optionalUrl,
  INTERNAL_WEBHOOK_SETUP_TOKEN: optionalMinLengthString(16),
  VERCEL_PROTECTION_BYPASS_SECRET: optionalMinLengthString(1),
});

export function parseEnvironment(rawEnv: NodeJS.ProcessEnv) {
  return envSchema.safeParse(rawEnv);
}

const parsed = parseEnvironment(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${message}`);
}

export const env = parsed.data;

export const runtime = {
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  adminTelegramId: BigInt(env.ADMIN_TELEGRAM_ID),
} as const;
