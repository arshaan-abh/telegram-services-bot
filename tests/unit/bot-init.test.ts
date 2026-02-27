import { describe, expect, it, vi } from "vitest";

import { ensureBotInitialized } from "../../src/bot/init.js";

describe("ensureBotInitialized", () => {
  it("calls init when bot is not initialized", async () => {
    const init = vi.fn().mockResolvedValue(undefined);
    const bot = {
      isInited: () => false,
      init,
    };

    await ensureBotInitialized(bot);

    expect(init).toHaveBeenCalledTimes(1);
  });

  it("does not call init when bot is already initialized", async () => {
    const init = vi.fn().mockResolvedValue(undefined);
    const bot = {
      isInited: () => true,
      init,
    };

    await ensureBotInitialized(bot);

    expect(init).not.toHaveBeenCalled();
  });
});
