import type { RawApi } from "grammy";
import type { Update } from "grammy/types";

import { getBot } from "../../src/bot/bot.js";

type CapturedCall = {
  method: keyof RawApi;
  payload: unknown;
};

export async function runBotUpdate(update: Update): Promise<CapturedCall[]> {
  const bot = getBot();
  const calls: CapturedCall[] = [];

  bot.api.config.use((_prev, method, payload) => {
    calls.push({
      method,
      payload,
    });

    if (method === "sendMessage") {
      return Promise.resolve({
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 1, type: "private" },
        text: "ok",
      } as never);
    }

    return Promise.resolve(true as never);
  });

  await bot.handleUpdate(update);
  return calls;
}
