import pino from "pino";
import { env } from "../config/env.js";
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "env.BOT_TOKEN",
      "env.QSTASH_TOKEN",
      "env.UPSTASH_REDIS_REST_TOKEN",
      "env.DATABASE_URL",
    ],
    censor: "[REDACTED]",
  },
});
export const childLogger = (
  bindings: Record<string, string | number | boolean>,
) => logger.child(bindings);
