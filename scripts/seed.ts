import { eq } from "drizzle-orm";

import { closeDb, db } from "../src/db/client.js";
import { services } from "../src/db/schema.js";

async function main(): Promise<void> {
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
