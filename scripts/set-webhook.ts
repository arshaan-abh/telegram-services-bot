import { env } from "../src/config/env.js";
import { addVercelProtectionBypassToUrl } from "../src/utils/vercel-protection.js";

async function main(): Promise<void> {
  const webhookUrl = addVercelProtectionBypassToUrl(
    `${env.APP_BASE_URL}/api/telegram/webhook`,
  );
  const endpoint = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
    }),
  });

  const payload = (await response.json()) as { ok?: boolean };
  if (!response.ok || !payload.ok) {
    throw new Error(`Failed to set webhook: ${JSON.stringify(payload)}`);
  }

  console.log(`Webhook set to ${webhookUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
