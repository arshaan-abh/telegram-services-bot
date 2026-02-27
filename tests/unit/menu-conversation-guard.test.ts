import { describe, expect, it, vi } from "vitest";

import { enterConversationSafely } from "../../src/bot/menus/main.js";

describe("enterConversationSafely", () => {
  it("replies with generic error when conversation flavor is unavailable", async () => {
    const ctx = {
      t: (key: string) => key,
      reply: vi.fn(() => Promise.resolve({})),
      conversation: undefined,
    };

    await enterConversationSafely(ctx as never, "createServiceConversation");

    expect(ctx.reply).toHaveBeenCalledWith("error-generic");
  });

  it("enters the requested conversation when conversation flavor exists", async () => {
    const enter = vi.fn(() => Promise.resolve({}));
    const ctx = {
      t: (key: string) => key,
      reply: vi.fn(() => Promise.resolve({})),
      conversation: {
        enter,
      },
    };

    await enterConversationSafely(ctx as never, "createServiceConversation");

    expect(enter).toHaveBeenCalledWith("createServiceConversation");
    expect(ctx.reply).not.toHaveBeenCalledWith("error-generic");
  });
});
