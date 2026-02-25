import { describe, expect, it } from "vitest";

import {
  buildUnknownCallbackResponse,
  deriveOrderIdFromCallbackData,
} from "../../src/bot/callbacks.js";

describe("callback helpers", () => {
  it("extracts order id from valid admin callback payloads", () => {
    expect(deriveOrderIdFromCallbackData("v1:admin:order:done:order-123")).toBe(
      "order-123",
    );
    expect(
      deriveOrderIdFromCallbackData("v1:admin:order:contact:abc-789"),
    ).toBe("abc-789");
  });

  it("returns null for invalid admin callback payloads", () => {
    expect(
      deriveOrderIdFromCallbackData("v1:admin:order:unknown:order-1"),
    ).toBeNull();
    expect(deriveOrderIdFromCallbackData("v1:admin:order:done:")).toBeNull();
    expect(deriveOrderIdFromCallbackData(undefined)).toBeNull();
  });

  it("keeps v1 unknown callback fallback non-alert", () => {
    const response = buildUnknownCallbackResponse(
      "v1:anything:else",
      (key) => key,
    );

    expect(response).toEqual({
      text: "unknown-action",
    });
  });

  it("shows alert for non-v1 callback versions", () => {
    const response = buildUnknownCallbackResponse(
      "v2:anything:else",
      (key) => key,
    );

    expect(response).toEqual({
      text: "unknown-action",
      show_alert: true,
    });
  });
});
