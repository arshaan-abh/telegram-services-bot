import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-telegram-bot-api-secret-token",
      "req.headers.upstash-signature",
      "req.headers.x-internal-token",
      "headers.authorization",
      "headers.x-telegram-bot-api-secret-token",
      "headers.upstash-signature",
      "headers.x-internal-token",
      "env.BOT_TOKEN",
      "env.QSTASH_TOKEN",
      "env.UPSTASH_REDIS_REST_TOKEN",
      "env.DATABASE_URL",
      "CARD_NUMBER",
      "proofFileId",
      "proof_file_id",
    ],
    censor: "[REDACTED]",
  },
});

export const childLogger = (
  bindings: Record<string, string | number | boolean | null>,
) => logger.child(bindings);
