import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuditLogMock, createDiscountCodeMock, listAllServicesMock } =
  vi.hoisted(() => ({
    createAuditLogMock: vi.fn(),
    createDiscountCodeMock: vi.fn(),
    listAllServicesMock: vi.fn(),
  }));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/discounts.js", () => ({
  createDiscountCode: createDiscountCodeMock,
  listDiscountCodes: vi.fn(),
  updateDiscountCode: vi.fn(),
}));

vi.mock("../../src/db/repositories/services.js", () => ({
  listAllServices: listAllServicesMock,
}));

import { createDiscountConversation } from "../../src/bot/conversations/discount-admin.js";

function createConversation(messages: string[]) {
  const queue = [...messages];
  return {
    waitFor: vi.fn(() =>
      Promise.resolve({
        message: {
          text: queue.shift() ?? "",
        },
        t: (key: string) => key,
        reply: vi.fn(),
      }),
    ),
    external: <T>(fn: () => Promise<T> | T) => Promise.resolve(fn()),
  };
}

function createContext() {
  const t = vi.fn((key: string) => key);
  return {
    isAdmin: true,
    from: { id: 999 },
    dbUserId: "admin-user-id",
    reply: vi.fn(() => Promise.resolve({})),
    t,
  };
}

describe("discount create validation flow", () => {
  beforeEach(() => {
    createAuditLogMock.mockReset();
    createDiscountCodeMock.mockReset();
    listAllServicesMock.mockReset();
  });

  it("re-prompts invalid numeric/date/limit inputs and persists valid values", async () => {
    listAllServicesMock.mockResolvedValueOnce([
      { id: "svc-1", title: "Service One" },
    ]);
    createDiscountCodeMock.mockResolvedValueOnce({
      id: "disc-1",
      code: "SAVE10",
    });

    const conversation = createConversation([
      "save10",
      "percent",
      "bad-amount",
      "10",
      "-",
      "-",
      "bad-date",
      "-",
      "-",
      "0",
      "3",
      "-",
      "yes",
      "-",
    ]);
    const ctx = createContext();

    await createDiscountConversation(conversation as never, ctx as never);

    expect(ctx.t).toHaveBeenCalledWith("discount-admin-create-code-prompt");
    expect(ctx.t).toHaveBeenCalledWith("discount-admin-create-type-prompt");
    expect(ctx.reply).toHaveBeenCalledWith("discount-admin-error-money");
    expect(ctx.reply).toHaveBeenCalledWith("discount-admin-error-datetime");
    expect(ctx.reply).toHaveBeenCalledWith("discount-admin-error-usage-limit");
    expect(createDiscountCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SAVE10",
        amount: "10",
        totalUsageLimit: 3,
      }),
    );
  });
});
