import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
}));

vi.mock("../../src/adapters/upstash.js", () => ({
  qstashReceiver: {
    verify: verifyMock,
  },
}));

import {
  verifyQStashSignature,
  verifyTelegramSecretToken,
} from "../../src/security/webhook.js";

describe("webhook security", () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it("rejects Telegram webhook when secret is missing", () => {
    expect(verifyTelegramSecretToken({})).toBe(false);
  });

  it("accepts Telegram webhook with valid secret", () => {
    expect(
      verifyTelegramSecretToken({
        "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET,
      }),
    ).toBe(true);
  });

  it("rejects QStash webhook when signature missing", async () => {
    const result = await verifyQStashSignature({
      signature: null,
      body: "{}",
      url: "https://example.com",
    });

    expect(result).toBe(false);
  });

  it("accepts QStash webhook when receiver verifies signature", async () => {
    verifyMock.mockResolvedValueOnce(true);

    const result = await verifyQStashSignature({
      signature: "sig",
      body: "{}",
      url: "https://example.com",
    });

    expect(result).toBe(true);
  });
});
