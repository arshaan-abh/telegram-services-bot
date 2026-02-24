import { desc } from "drizzle-orm";

import { db } from "../client.js";
import { auditLogs } from "../schema.js";

export async function createAuditLog(input: {
  actorTelegramId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const rows = await db
    .insert(auditLogs)
    .values({
      actorTelegramId: input.actorTelegramId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create audit log");
  }

  return created;
}

export async function listRecentAuditLogs(limit = 20) {
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
