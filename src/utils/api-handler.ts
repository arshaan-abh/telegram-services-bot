import { randomUUID } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { logger } from "../observability/logger.js";
import { Sentry } from "../observability/sentry.js";
import { DomainError } from "../services/errors.js";

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
    const startedAt = Date.now();

    try {
      await handler(req, res);
      logger.info(
        {
          requestId,
          method: req.method,
          url: req.url,
          durationMs: Date.now() - startedAt,
          statusCode: res.statusCode,
        },
        "api_handler_completed",
      );
    } catch (error) {
      const domainError = error instanceof DomainError ? error : null;
      logger.error(
        {
          err: error,
          requestId,
          method: req.method,
          url: req.url,
          code: domainError?.code ?? "internal_error",
        },
        "api_handler_failed",
      );
      Sentry.captureException(error);

      if (!res.headersSent) {
        const statusCode = domainError?.statusCode ?? 500;
        res.status(statusCode).json({
          ok: false,
          error: domainError?.code ?? "internal_error",
          requestId,
        });
      }
    }
  };
}
