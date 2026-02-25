import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuditLogMock, createServiceMock } = vi.hoisted(() => ({
  createAuditLogMock: vi.fn(),
  createServiceMock: vi.fn(),
}));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/services.js", () => ({
  createService: createServiceMock,
  deactivateService: vi.fn(),
  listAllServices: vi.fn(),
  updateService: vi.fn(),
}));

import { createServiceConversation } from "../../src/bot/conversations/service-admin.js";

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

describe("service admin validation flow", () => {
  beforeEach(() => {
    createAuditLogMock.mockReset();
    createServiceMock.mockReset();
  });

  it("re-prompts invalid numeric inputs and continues with valid values", async () => {
    createServiceMock.mockResolvedValueOnce({
      id: "svc-1",
      title: "Starter",
    });

    const conversation = createConversation([
      "Starter",
      "invalid-price",
      "12.50",
      "-",
      "note-1, note-2",
      "email,password",
      "999",
      "30",
    ]);
    const ctx = createContext();

    await createServiceConversation(conversation as never, ctx as never);

    expect(ctx.t).toHaveBeenCalledWith("service-admin-create-title-prompt");
    expect(ctx.t).toHaveBeenCalledWith("service-admin-create-price-prompt");
    expect(ctx.reply).toHaveBeenCalledWith("service-admin-error-price-format");
    expect(ctx.reply).toHaveBeenCalledWith(
      "service-admin-error-duration-range",
    );
    expect(ctx.t).toHaveBeenCalledWith(
      "service-admin-created",
      expect.objectContaining({ title: "Starter" }),
    );
    expect(createServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Starter",
        price: "12.50",
        durationDays: 30,
      }),
      "999",
    );
  });
});
