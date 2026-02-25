import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

let initialized = false;

const REDACTED = "[REDACTED]";
const sensitiveKeyPattern =
  /(token|authorization|secret|password|card|proof|signature|dsn|database_url)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(record)) {
      sanitized[key] = sensitiveKeyPattern.test(key)
        ? REDACTED
        : sanitize(nestedValue);
    }
    return sanitized;
  }

  return value;
}

export function initSentry(): void {
  if (initialized || !env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return sanitize(event) as typeof event;
    },
  });

  process.on("uncaughtException", (error) => {
    Sentry.captureException(error);
  });

  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
  });

  initialized = true;
}
export { Sentry };
