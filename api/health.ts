import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";

import { redis } from "../src/adapters/upstash.js";
import { db } from "../src/db/client.js";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    await db.execute(sql`select 1`);
    await redis.ping();

    res.status(200).json({
      ok: true,
      db: "up",
      redis: "up",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
}
