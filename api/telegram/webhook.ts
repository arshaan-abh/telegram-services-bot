import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getBot } from "../../src/bot/bot.js";
import { verifyTelegramSecretToken } from "../../src/security/webhook.js";
import { withApiErrorBoundary } from "../../src/utils/api-handler.js";
import { readRawBody } from "../../src/utils/http.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!verifyTelegramSecretToken(req.headers)) {
    res.status(401).json({ ok: false, error: "invalid_telegram_secret" });
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  if (
    typeof contentType === "string" &&
    !contentType.includes("application/json")
  ) {
    res.status(415).json({ ok: false, error: "unsupported_media_type" });
    return;
  }

  const rawBody = await readRawBody(req);
  const update = JSON.parse(rawBody) as Parameters<
    ReturnType<typeof getBot>["handleUpdate"]
  >[0];

  await getBot().handleUpdate(update);

  res.status(200).json({ ok: true });
}

export default withApiErrorBoundary(handler);
