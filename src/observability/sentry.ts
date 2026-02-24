import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";
let initialized = false;
export function initSentry(): void {
  if (initialized || !env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
  initialized = true;
}
export { Sentry };
