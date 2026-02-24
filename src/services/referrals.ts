import { createReferral } from "../db/repositories/referrals.js";
import { getUserByReferralToken } from "../db/repositories/users.js";

const REF_PREFIX = "ref_";

export function parseReferralToken(
  startPayload: string | undefined,
): string | null {
  if (!startPayload || !startPayload.startsWith(REF_PREFIX)) {
    return null;
  }

  const token = startPayload.slice(REF_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export async function linkReferralIfEligible(
  inviteeUserId: string,
  token: string,
): Promise<boolean> {
  const inviter = await getUserByReferralToken(token);
  if (!inviter || inviter.id === inviteeUserId) {
    return false;
  }

  const created = await createReferral(inviter.id, inviteeUserId);
  return Boolean(created);
}
