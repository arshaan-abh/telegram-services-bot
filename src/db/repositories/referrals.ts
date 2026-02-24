import { and, count, eq } from "drizzle-orm";

import { db } from "../client.js";
import { orders, referrals } from "../schema.js";

export async function getReferralByInvitee(inviteeUserId: string) {
  const rows = await db
    .select()
    .from(referrals)
    .where(eq(referrals.inviteeUserId, inviteeUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createReferral(
  inviterUserId: string,
  inviteeUserId: string,
) {
  if (inviterUserId === inviteeUserId) {
    return null;
  }

  const existing = await getReferralByInvitee(inviteeUserId);
  if (existing) {
    return existing;
  }

  const rows = await db
    .insert(referrals)
    .values({
      inviterUserId,
      inviteeUserId,
    })
    .returning();

  return rows[0] ?? null;
}

export async function hasApprovedOrder(userId: string): Promise<boolean> {
  const rows = await db
    .select({ value: count() })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "approved")));

  return (rows[0]?.value ?? 0) > 0;
}
