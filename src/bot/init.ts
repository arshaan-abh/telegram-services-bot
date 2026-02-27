type InitializableBot = {
  isInited: () => boolean;
  init: () => Promise<unknown>;
};

const initInFlight = new WeakMap<InitializableBot, Promise<void>>();

export async function ensureBotInitialized(
  bot: InitializableBot,
): Promise<void> {
  if (bot.isInited()) {
    return;
  }

  const pending = initInFlight.get(bot);
  if (pending) {
    await pending;
    return;
  }

  const initialize = (async () => {
    await bot.init();
  })();
  initInFlight.set(bot, initialize);

  try {
    await initialize;
  } finally {
    initInFlight.delete(bot);
  }

  if (!bot.isInited()) {
    throw new Error("Bot initialization did not complete");
  }
}
