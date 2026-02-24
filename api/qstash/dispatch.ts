import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getBot } from "../../src/bot/bot.js";
import { verifyQStashSignature } from "../../src/security/webhook.js";
import { dispatchNotificationById } from "../../src/services/notifications.js";
import { readRawBody } from "../../src/utils/http.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
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

  await dispatchNotificationById(getBot(), body.notificationId);

  res.status(200).json({ ok: true });
}
