type InitializableBot = {
  isInited: () => boolean;
  init: () => Promise<unknown>;
};

export async function ensureBotInitialized(
  bot: InitializableBot,
): Promise<void> {
  if (bot.isInited()) {
    return;
  }

  await bot.init();
}
