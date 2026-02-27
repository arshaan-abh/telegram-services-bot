import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBotMock,
  ensureBotInitializedMock,
  verifyTelegramSecretTokenMock,
  readRawBodyMock,
  handleUpdateMock,
} = vi.hoisted(() => {
  const handleUpdate = vi.fn();
  return {
    getBotMock: vi.fn(() => ({
      handleUpdate,
    })),
    ensureBotInitializedMock: vi.fn(),
    verifyTelegramSecretTokenMock: vi.fn(),
    readRawBodyMock: vi.fn(),
    handleUpdateMock: handleUpdate,
  };
});

vi.mock("../../src/bot/bot.js", () => ({
  getBot: getBotMock,
}));

vi.mock("../../src/bot/init.js", () => ({
  ensureBotInitialized: ensureBotInitializedMock,
}));

vi.mock("../../src/security/webhook.js", () => ({
  verifyTelegramSecretToken: verifyTelegramSecretTokenMock,
}));

vi.mock("../../src/utils/http.js", () => ({
  readRawBody: readRawBodyMock,
}));

vi.mock("../../src/utils/api-handler.js", () => ({
  withApiErrorBoundary: <T>(handler: T): T => handler,
}));

import webhookHandler from "../../api/telegram/webhook.js";

type TestRequest = {
  method?: string;
  headers: Record<string, string>;
};

function createResponse() {
  const response: {
    statusCode: number | null;
    body: unknown;
    status: (code: number) => typeof response;
    json: (value: unknown) => typeof response;
  } = {
    statusCode: null,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };

  return response;
}

describe("telegram webhook handler", () => {
  beforeEach(() => {
    getBotMock.mockClear();
    ensureBotInitializedMock.mockReset();
    verifyTelegramSecretTokenMock.mockReset();
    readRawBodyMock.mockReset();
    handleUpdateMock.mockReset();
  });

  it("initializes bot before handling update", async () => {
    verifyTelegramSecretTokenMock.mockReturnValueOnce(true);
    readRawBodyMock.mockResolvedValueOnce(JSON.stringify({ update_id: 1 }));
    ensureBotInitializedMock.mockResolvedValueOnce(undefined);
    handleUpdateMock.mockResolvedValueOnce(undefined);

    const req = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret",
      },
    } satisfies TestRequest;
    const res = createResponse();

    await webhookHandler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(ensureBotInitializedMock).toHaveBeenCalledTimes(1);
    expect(handleUpdateMock).toHaveBeenCalledTimes(1);

    const ensureOrder = ensureBotInitializedMock.mock.invocationCallOrder[0];
    const handleOrder = handleUpdateMock.mock.invocationCallOrder[0];
    expect(ensureOrder).toBeDefined();
    expect(handleOrder).toBeDefined();
    if (ensureOrder === undefined || handleOrder === undefined) {
      throw new Error("Expected call order to be defined");
    }
    expect(ensureOrder).toBeLessThan(handleOrder);
  });
});
