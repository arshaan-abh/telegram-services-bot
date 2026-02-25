import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuditLogMock, listDiscountCodesMock, updateDiscountCodeMock } =
  vi.hoisted(() => ({
    createAuditLogMock: vi.fn(),
    listDiscountCodesMock: vi.fn(),
    updateDiscountCodeMock: vi.fn(),
  }));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/discounts.js", () => ({
  createDiscountCode: vi.fn(),
  listDiscountCodes: listDiscountCodesMock,
  updateDiscountCode: updateDiscountCodeMock,
}));

vi.mock("../../src/db/repositories/services.js", () => ({
  listAllServices: vi.fn(),
}));

import { editDiscountConversation } from "../../src/bot/conversations/discount-admin.js";

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
  return {
    isAdmin: true,
    from: { id: 999 },
    dbUserId: "admin-user-id",
    reply: vi.fn(() => Promise.resolve({})),
    t: (key: string) => key,
  };
}

describe("discount edit flow", () => {
  beforeEach(() => {
    createAuditLogMock.mockReset();
    listDiscountCodesMock.mockReset();
    updateDiscountCodeMock.mockReset();
  });

  it("updates discount code with normalized value", async () => {
    listDiscountCodesMock.mockResolvedValueOnce([
      { id: "disc-1", code: "OLD", isActive: true },
    ]);
    updateDiscountCodeMock.mockResolvedValueOnce({
      id: "disc-1",
      code: "SAVE10",
    });

    const conversation = createConversation(["disc-1", "code", " save10 "]);
    const ctx = createContext();

    await editDiscountConversation(conversation as never, ctx as never);

    expect(updateDiscountCodeMock).toHaveBeenCalledWith(
      "disc-1",
      { code: "SAVE10" },
      "999",
      undefined,
    );
  });

  it("updates discount service scope list", async () => {
    listDiscountCodesMock.mockResolvedValueOnce([
      { id: "disc-2", code: "SAVE20", isActive: true },
    ]);
    updateDiscountCodeMock.mockResolvedValueOnce({
      id: "disc-2",
      code: "SAVE20",
    });

    const conversation = createConversation([
      "disc-2",
      "serviceScope",
      "svc-1, svc-2",
    ]);
    const ctx = createContext();

    await editDiscountConversation(conversation as never, ctx as never);

    expect(updateDiscountCodeMock).toHaveBeenCalledWith("disc-2", {}, "999", [
      "svc-1",
      "svc-2",
    ]);
  });
});
