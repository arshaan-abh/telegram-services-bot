import { eq } from "drizzle-orm";

import { env } from "../src/config/env.js";
import { closeDb, db } from "../src/db/client.js";
import { services, users } from "../src/db/schema.js";

async function main(): Promise<void> {
  const adminRows = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, env.ADMIN_TELEGRAM_ID))
    .limit(1);
  if (adminRows.length === 0) {
    console.log(
      `Admin bootstrap sanity check: admin user ${env.ADMIN_TELEGRAM_ID} not found yet (expected before first admin interaction).`,
    );
  } else {
    console.log(
      `Admin bootstrap sanity check: found ${env.ADMIN_TELEGRAM_ID}.`,
    );
  }

  const existing = await db
    .select()
    .from(services)
    .where(eq(services.title, "Demo Service"))
    .limit(1);
  if (existing.length > 0) {
    console.log("Demo service already exists");
    return;
  }

  await db.insert(services).values({
    title: "Demo Service",
    price: "10.00",
    description: "Demo service for local testing",
    notes: ["Manual activation", "Sample note"],
    neededFields: ["email", "password"],
    durationDays: 30,
    createdBy: "seed",
    updatedBy: "seed",
  });

  console.log("Demo service inserted");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
