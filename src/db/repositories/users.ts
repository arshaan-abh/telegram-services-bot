import { randomBytes } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../client.js";
import { creditLedger, users } from "../schema.js";

export type TelegramProfileInput = {
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
};

function createReferralToken(): string {
  return randomBytes(8).toString("hex");
}

export async function getUserByTelegramId(telegramId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByReferralToken(token: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.referralToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTelegramUser(profile: TelegramProfileInput) {
  const existing = await getUserByTelegramId(profile.telegramId);
  if (existing) {
    const rows = await db
      .update(users)
      .set({
        username: profile.username ?? null,
        firstName: profile.firstName,
        lastName: profile.lastName ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    return rows[0] ?? existing;
  }

  const rows = await db
    .insert(users)
    .values({
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName ?? null,
      referralToken: createReferralToken(),
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create user");
  }

  return created;
}

export async function getCreditBalanceMinor(userId: string): Promise<string> {
  const rows = await db
    .select({ balanceAfter: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);

  return rows[0]?.balanceAfter ?? "0.00";
}

export async function listAllUsers() {
  return db.select().from(users);
}

export async function getUserByOrderAndTelegram(
  orderUserId: string,
  telegramId: string,
) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, orderUserId), eq(users.telegramId, telegramId)))
    .limit(1);

  return rows[0] ?? null;
}
