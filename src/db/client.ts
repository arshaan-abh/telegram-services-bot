import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "../config/env.js";
import * as schema from "./schema.js";
neonConfig.webSocketConstructor = ws;
const globalDb = globalThis as typeof globalThis & { __telegramBotPool?: Pool };
type PoolConstructor = new (config?: unknown) => Pool;
type ClosablePool = Pool & { end?: () => Promise<void> };

const PoolWithConfig = Pool as unknown as PoolConstructor;
const pool =
  globalDb.__telegramBotPool ??
  new PoolWithConfig({
    connectionString: env.DATABASE_URL,
    max: 4,
  });
if (!globalDb.__telegramBotPool) {
  globalDb.__telegramBotPool = pool;
}
export const db = drizzle({ client: pool, schema });
export async function closeDb(): Promise<void> {
  const closable = pool as ClosablePool;
  if (typeof closable.end === "function") {
    await closable.end();
  }
}
