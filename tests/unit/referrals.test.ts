import { beforeEach, describe, expect, it, vi } from "vitest";

const { createReferralMock, getUserByReferralTokenMock } = vi.hoisted(() => ({
  createReferralMock: vi.fn(),
  getUserByReferralTokenMock: vi.fn(),
}));

vi.mock("../../src/db/repositories/referrals.js", () => ({
  createReferral: createReferralMock,
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  getUserByReferralToken: getUserByReferralTokenMock,
}));

import {
  linkReferralIfEligible,
  parseReferralToken,
} from "../../src/services/referrals.js";

describe("referrals service", () => {
  beforeEach(() => {
    createReferralMock.mockReset();
    getUserByReferralTokenMock.mockReset();
  });

  it("parses valid start payload token", () => {
    expect(parseReferralToken("ref_token-123")).toBe("token-123");
    expect(parseReferralToken("ref_  abc  ")).toBe("abc");
  });

  it("rejects invalid referral payloads", () => {
    expect(parseReferralToken(undefined)).toBeNull();
    expect(parseReferralToken("")).toBeNull();
    expect(parseReferralToken("foo_bar")).toBeNull();
    expect(parseReferralToken("ref_   ")).toBeNull();
  });

  it("does not create referral when inviter does not exist or self-refers", async () => {
    getUserByReferralTokenMock.mockResolvedValueOnce(null);
    await expect(linkReferralIfEligible("invitee-1", "token")).resolves.toBe(
      false,
    );
    expect(createReferralMock).not.toHaveBeenCalled();

    getUserByReferralTokenMock.mockResolvedValueOnce({ id: "invitee-1" });
    await expect(linkReferralIfEligible("invitee-1", "token")).resolves.toBe(
      false,
    );
    expect(createReferralMock).not.toHaveBeenCalled();
  });

  it("creates referral when inviter is valid and distinct", async () => {
    getUserByReferralTokenMock.mockResolvedValueOnce({ id: "inviter-1" });
    createReferralMock.mockResolvedValueOnce({ id: "ref-1" });

    await expect(linkReferralIfEligible("invitee-1", "token")).resolves.toBe(
      true,
    );
    expect(createReferralMock).toHaveBeenCalledWith("inviter-1", "invitee-1");
  });
});
