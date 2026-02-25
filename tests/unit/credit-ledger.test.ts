import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, valuesMock, returningMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
  returningMock: vi.fn(),
}));

vi.mock("../../src/db/client.js", () => ({
  db: {
    insert: insertMock,
  },
}));

import { addCreditLedgerEntry } from "../../src/db/repositories/credits.js";

describe("credit ledger repository", () => {
  beforeEach(() => {
    insertMock.mockReset();
    valuesMock.mockReset();
    returningMock.mockReset();

    insertMock.mockReturnValue({
      values: valuesMock,
    });
    valuesMock.mockReturnValue({
      returning: returningMock,
    });
  });

  it("creates ledger entry and returns inserted row", async () => {
    returningMock.mockResolvedValueOnce([
      {
        id: "ledger-1",
        userId: "u1",
      },
    ]);

    const created = await addCreditLedgerEntry({
      userId: "u1",
      type: "admin_adjustment",
      amount: "5.00",
      balanceAfter: "15.00",
      orderId: null,
      note: "manual correction",
      createdBy: "admin",
    });

    expect(created.id).toBe("ledger-1");
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "admin_adjustment",
        amount: "5.00",
        balanceAfter: "15.00",
        createdBy: "admin",
      }),
    );
  });

  it("throws when insert returns no rows", async () => {
    returningMock.mockResolvedValueOnce([]);

    await expect(
      addCreditLedgerEntry({
        userId: "u1",
        type: "spend",
        amount: "-5.00",
        balanceAfter: "10.00",
        orderId: "o1",
        note: "order spend",
        createdBy: "admin",
      }),
    ).rejects.toThrow("Failed to create credit ledger entry");
  });
});
