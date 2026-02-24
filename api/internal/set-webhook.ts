import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getBot } from "../../src/bot/bot.js";
import { env } from "../../src/config/env.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const tokenHeader = req.headers["x-internal-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  if (
    !env.INTERNAL_WEBHOOK_SETUP_TOKEN ||
    token !== env.INTERNAL_WEBHOOK_SETUP_TOKEN
  ) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const webhookUrl = `${env.APP_BASE_URL}/api/telegram/webhook`;

  await getBot().api.setWebhook(webhookUrl, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: [
      "message",
      "callback_query",
      "chat_member",
      "my_chat_member",
      "channel_post",
    ],
  });

  res.status(200).json({ ok: true, webhookUrl });
}
