import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "../config/env.js";
import * as schema from "./schema.js";
neonConfig.webSocketConstructor = ws;
const globalDb = globalThis as typeof globalThis & { __telegramBotPool?: Pool };
const pool =
  globalDb.__telegramBotPool ??
  new Pool({ connectionString: env.DATABASE_URL, max: 4 });
if (!globalDb.__telegramBotPool) {
  globalDb.__telegramBotPool = pool;
}
export const db = drizzle({ client: pool, schema });
export async function closeDb(): Promise<void> {
  await pool.end();
}
