import { getBot } from "./bot/bot.js";
import { logger } from "./observability/logger.js";

async function main(): Promise<void> {
  const bot = getBot();

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.start({
    allowed_updates: ["message", "callback_query"],
  });

  logger.info("Bot started in long-polling mode");
}

main().catch((error) => {
  logger.error({ err: error }, "failed_to_start_bot");
  process.exit(1);
});
