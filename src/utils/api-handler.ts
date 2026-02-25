import { randomUUID } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { logger } from "../observability/logger.js";
import { Sentry } from "../observability/sentry.js";

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void;

function resolveRequestId(req: VercelRequest, res: VercelResponse): string {
  const requestIdHeader = req.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader)
    ? (requestIdHeader[0] ?? randomUUID())
    : (requestIdHeader ?? randomUUID());

  if (typeof res.setHeader === "function") {
    res.setHeader("x-request-id", requestId);
  }

  return requestId;
}

export function withApiErrorBoundary(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    const requestId = resolveRequestId(req, res);

    try {
      await handler(req, res);
    } catch (error) {
      logger.error(
        {
          err: error,
          requestId,
          method: req.method,
          url: req.url,
        },
        "api_handler_failed",
      );
      Sentry.captureException(error);

      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: "internal_error",
          requestId,
        });
      }
    }
  };
}
