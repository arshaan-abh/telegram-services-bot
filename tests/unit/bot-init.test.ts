import { describe, expect, it, vi } from "vitest";

import { ensureBotInitialized } from "../../src/bot/init.js";

describe("ensureBotInitialized", () => {
  it("calls init when bot is not initialized", async () => {
    let initialized = false;
    const init = vi.fn().mockImplementation(() => {
      initialized = true;
      return Promise.resolve(undefined);
    });
    const bot = {
      isInited: () => initialized,
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

  it("deduplicates concurrent initialization calls", async () => {
    let initialized = false;
    const init = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      initialized = true;
    });
    const bot = {
      isInited: () => initialized,
      init,
    };

    await Promise.all([ensureBotInitialized(bot), ensureBotInitialized(bot)]);

    expect(init).toHaveBeenCalledTimes(1);
    expect(initialized).toBe(true);
  });

  it("allows retry when a previous initialization attempt fails", async () => {
    let initialized = false;
    const init = vi
      .fn()
      .mockRejectedValueOnce(new Error("init_fail"))
      .mockImplementationOnce(() => {
        initialized = true;
        return Promise.resolve(undefined);
      });
    const bot = {
      isInited: () => initialized,
      init,
    };

    await expect(ensureBotInitialized(bot)).rejects.toThrow("init_fail");
    await expect(ensureBotInitialized(bot)).resolves.toBeUndefined();
    expect(init).toHaveBeenCalledTimes(2);
    expect(initialized).toBe(true);
  });
});
