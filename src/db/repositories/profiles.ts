import { and, desc, eq } from "drizzle-orm";

import { checksum } from "../../utils/hash.js";
import { db } from "../client.js";
import { serviceFieldProfiles } from "../schema.js";

export async function getLatestFieldProfile(userId: string, serviceId: string) {
  const rows = await db
    .select()
    .from(serviceFieldProfiles)
    .where(
      and(
        eq(serviceFieldProfiles.userId, userId),
        eq(serviceFieldProfiles.serviceId, serviceId),
      ),
    )
    .orderBy(desc(serviceFieldProfiles.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertFieldProfile(
  userId: string,
  serviceId: string,
  values: Record<string, string>,
) {
  const digest = checksum(values);

  const existingRows = await db
    .select()
    .from(serviceFieldProfiles)
    .where(
      and(
        eq(serviceFieldProfiles.userId, userId),
        eq(serviceFieldProfiles.serviceId, serviceId),
        eq(serviceFieldProfiles.checksum, digest),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    const rows = await db
      .update(serviceFieldProfiles)
      .set({ values, updatedAt: new Date() })
      .where(eq(serviceFieldProfiles.id, existingRows[0].id))
      .returning();

    return rows[0] ?? existingRows[0];
  }

  const rows = await db
    .insert(serviceFieldProfiles)
    .values({
      userId,
      serviceId,
      values,
      checksum: digest,
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create field profile");
  }

  return created;
}
