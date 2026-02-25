import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getBot } from "../../src/bot/bot.js";
import { verifyQStashSignature } from "../../src/security/webhook.js";
import { dispatchNotificationById } from "../../src/services/notifications.js";
import { withApiErrorBoundary } from "../../src/utils/api-handler.js";
import { readRawBody } from "../../src/utils/http.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers["upstash-signature"];
  const signatureCandidate = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  const signature = signatureCandidate ?? null;

  const requestUrl = `https://${req.headers.host}${req.url ?? "/api/qstash/dispatch"}`;
  const verified = await verifyQStashSignature({
    signature,
    body: rawBody,
    url: requestUrl,
  });

  if (!verified) {
    res.status(401).json({ ok: false, error: "invalid_qstash_signature" });
    return;
  }

  const body = JSON.parse(rawBody) as { notificationId?: string };
  if (!body.notificationId) {
    res.status(400).json({ ok: false, error: "missing_notification_id" });
    return;
  }

  const retryHeader = req.headers["upstash-retries"];
  const retryRaw = Array.isArray(retryHeader) ? retryHeader[0] : retryHeader;
  const retryCount = retryRaw ? Number(retryRaw) : undefined;

  const messageIdHeader = req.headers["upstash-message-id"];
  const messageId = Array.isArray(messageIdHeader)
    ? (messageIdHeader[0] ?? null)
    : (messageIdHeader ?? null);

  await dispatchNotificationById(getBot(), body.notificationId, {
    retryCount: Number.isFinite(retryCount) ? retryCount : undefined,
    qstashMessageId: messageId,
  });

  res.status(200).json({ ok: true });
}

export default withApiErrorBoundary(handler);
