import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  calculateSubscriptionEnd,
  formatDateForUser,
  shouldScheduleReminder,
} from "../../src/utils/date.js";
import { dbMoneyToMinor, minorToDbMoney } from "../../src/utils/db-money.js";
import { checksum, stableStringify } from "../../src/utils/hash.js";
import { readRawBody } from "../../src/utils/http.js";
import {
  clampMoney,
  formatMinorToMoney,
  parseMoneyToMinor,
  percentOf,
} from "../../src/utils/money.js";
import {
  escapeMarkdown,
  formatUserMention,
  normalizeDiscountCode,
} from "../../src/utils/telegram.js";

describe("money utilities", () => {
  it("parses and formats minor currency values", () => {
    expect(parseMoneyToMinor("12.3", 2)).toBe(1230n);
    expect(parseMoneyToMinor(5, 0)).toBe(5n);
    expect(formatMinorToMoney(1230n, 2)).toBe("12.30");
    expect(formatMinorToMoney(-1230n, 2)).toBe("-12.30");
    expect(formatMinorToMoney(12n, 0)).toBe("12");
  });

  it("rejects invalid money strings", () => {
    expect(() => parseMoneyToMinor("12.a", 2)).toThrow("Invalid money value");
    expect(() => parseMoneyToMinor("-1", 2)).toThrow("Invalid money value");
  });

  it("calculates percentage and clamps negatives", () => {
    expect(percentOf(10_000n, 12.5)).toBe(1250n);
    expect(percentOf(1_000n, 0)).toBe(0n);
    expect(percentOf(1_000n, -2)).toBe(0n);
    expect(clampMoney(-1n)).toBe(0n);
    expect(clampMoney(55n)).toBe(55n);
  });

  it("converts db decimal strings using configured decimals", () => {
    expect(dbMoneyToMinor("10.50")).toBe(1050n);
    expect(minorToDbMoney(1050n)).toBe("10.50");
  });
});

describe("date utilities", () => {
  it("computes subscription end dates and reminder windows", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const end = calculateSubscriptionEnd(startedAt, 30);

    expect(end.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(
      shouldScheduleReminder(
        new Date("2026-01-10T00:00:00.000Z"),
        new Date("2026-01-09T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      shouldScheduleReminder(
        new Date("2026-01-09T00:00:00.000Z"),
        new Date("2026-01-09T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("formats user-facing dates based on locale", () => {
    const date = new Date("2026-02-03T04:05:00.000Z");
    expect(formatDateForUser(date, "UTC", "en")).toBe("2026-02-03 04:05");
    expect(formatDateForUser(date, "UTC", "fa")).toBe("2026/02/03 04:05");
  });
});

describe("telegram text helpers", () => {
  it("escapes markdown and builds mention links", () => {
    expect(escapeMarkdown("Hello [user]!")).toBe("Hello \\[user\\]\\!");
    expect(formatUserMention("123", "A_B")).toBe("[A\\_B](tg://user?id=123)");
    expect(normalizeDiscountCode("  save10  ")).toBe("SAVE10");
  });
});

describe("hash helpers", () => {
  it("stable-stringifies nested objects deterministically", () => {
    const a = {
      z: [2, { b: 2, a: 1 }],
      a: "x",
    };
    const b = {
      a: "x",
      z: [2, { a: 1, b: 2 }],
    };

    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(checksum(a)).toBe(checksum(b));
  });
});

describe("http helpers", () => {
  it("reads request body as utf8 text", async () => {
    const stream = new PassThrough();
    const bodyPromise = readRawBody(stream as never);
    stream.write("hello ");
    stream.end("world");

    await expect(bodyPromise).resolves.toBe("hello world");
  });

  it("propagates stream errors", async () => {
    const stream = new PassThrough();
    const bodyPromise = readRawBody(stream as never);
    stream.emit("error", new Error("boom"));

    await expect(bodyPromise).rejects.toThrow("boom");
  });
});
