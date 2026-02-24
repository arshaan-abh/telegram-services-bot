import { qstashReceiver } from "../adapters/upstash.js";
import { env } from "../config/env.js";

export function verifyTelegramSecretToken(
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const value = headers["x-telegram-bot-api-secret-token"];
  if (!value) {
    return false;
  }

  const token = Array.isArray(value) ? value[0] : value;
  return token === env.TELEGRAM_WEBHOOK_SECRET;
}

export async function verifyQStashSignature(input: {
  signature: string | null;
  body: string;
  url: string;
}): Promise<boolean> {
  if (!input.signature) {
    return false;
  }

  try {
    const verified = await qstashReceiver.verify({
      signature: input.signature,
      body: input.body,
      url: input.url,
    });

    return verified;
  } catch {
    return false;
  }
}
