import { desc, eq } from "drizzle-orm";

import { db } from "../client.js";
import { creditLedger } from "../schema.js";

export async function getCreditBalance(userId: string): Promise<string> {
  const rows = await db
    .select({ balanceAfter: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);

  return rows[0]?.balanceAfter ?? "0.00";
}

export async function listCreditLedger(userId: string) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt));
}

export async function addCreditLedgerEntry(input: {
  userId: string;
  type: "referral_reward" | "spend" | "admin_adjustment";
  amount: string;
  balanceAfter: string;
  orderId?: string | null;
  note?: string | null;
  createdBy: string;
}) {
  const rows = await db
    .insert(creditLedger)
    .values({
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      orderId: input.orderId ?? null,
      note: input.note ?? null,
      createdBy: input.createdBy,
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create credit ledger entry");
  }

  return created;
}
