import { access, readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";

import { redis } from "../src/adapters/upstash.js";
import { env } from "../src/config/env.js";
import { closeDb, db } from "../src/db/client.js";

type ReadinessCheck = {
  name: string;
  run: () => string | Promise<string>;
};

type ReadinessResult = {
  name: string;
  ok: boolean;
  details: string;
};

type MigrationJournal = {
  entries?: Array<{
    tag?: string;
  }>;
};

type TelegramWebhookInfoResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
};

type HealthResponse = {
  ok?: boolean;
  db?: string;
  redis?: string;
  error?: string;
};

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runReadinessChecks(
  checks: ReadinessCheck[],
): Promise<ReadinessResult[]> {
  const results: ReadinessResult[] = [];

  for (const check of checks) {
    try {
      const details = await check.run();
      results.push({ name: check.name, ok: true, details });
    } catch (error) {
      results.push({
        name: check.name,
        ok: false,
        details: asErrorMessage(error),
      });
    }
  }

  return results;
}

async function checkMigrationJournal(): Promise<string> {
  const journalPath = new URL("../drizzle/meta/_journal.json", import.meta.url);
  const raw = await readFile(journalPath, "utf8");
  const parsed = JSON.parse(raw) as MigrationJournal;

  if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
    throw new Error("No migration entries found in drizzle/meta/_journal.json");
  }

  for (const entry of parsed.entries) {
    if (!entry.tag) {
      throw new Error("Migration journal contains entry without tag");
    }
    await access(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url));
  }

  return `${parsed.entries.length} migration file(s) present`;
}

async function checkDatabaseConnectivity(): Promise<string> {
  await db.execute(sql`select 1`);
  return "Database query succeeded";
}

async function checkRedisConnectivity(): Promise<string> {
  await redis.ping();
  return "Redis ping succeeded";
}

async function checkHealthEndpoint(): Promise<string> {
  const response = await fetch(`${env.APP_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Health endpoint returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as HealthResponse;
  if (!payload.ok || payload.db !== "up" || payload.redis !== "up") {
    throw new Error(`Unexpected health payload: ${JSON.stringify(payload)}`);
  }

  return "Health endpoint reports DB and Redis up";
}

async function checkTelegramWebhookConfiguration(): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`,
  );
  const payload = (await response.json()) as TelegramWebhookInfoResponse;

  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(
      payload.description ?? "Unable to read Telegram webhook info",
    );
  }

  const expectedUrl = `${env.APP_BASE_URL}/api/telegram/webhook`;
  const actualUrl = payload.result.url ?? "";
  if (actualUrl !== expectedUrl) {
    throw new Error(
      `Webhook URL mismatch. Expected "${expectedUrl}", got "${actualUrl || "<empty>"}"`,
    );
  }

  return `Webhook URL matches (pending updates: ${payload.result.pending_update_count ?? 0})`;
}

function checkSentryConfiguration(): string {
  if (!env.SENTRY_DSN) {
    return "SENTRY_DSN is not configured (optional)";
  }
  return "SENTRY_DSN is configured";
}

function printResults(results: ReadinessResult[]): void {
  console.log("Production readiness validation");
  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`- [${status}] ${result.name}: ${result.details}`);
  }
}

async function main(): Promise<void> {
  const checks: ReadinessCheck[] = [
    {
      name: "Deployment runbook is available",
      run: async () => {
        await access(new URL("../docs/deployment.md", import.meta.url));
        return "docs/deployment.md found";
      },
    },
    {
      name: "Migration journal is complete",
      run: checkMigrationJournal,
    },
    {
      name: "Database connectivity",
      run: checkDatabaseConnectivity,
    },
    {
      name: "Redis connectivity",
      run: checkRedisConnectivity,
    },
    {
      name: "Health endpoint",
      run: checkHealthEndpoint,
    },
    {
      name: "Telegram webhook configuration",
      run: checkTelegramWebhookConfiguration,
    },
    {
      name: "Sentry configuration",
      run: checkSentryConfiguration,
    },
  ];

  const results = await runReadinessChecks(checks);
  printResults(results);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error(
      `Readiness checks failed: ${failed.length}/${results.length} check(s)`,
    );
  } else {
    console.log(`All ${results.length} readiness checks passed.`);
  }
}

main()
  .catch((error) => {
    console.error("Readiness validation crashed:", asErrorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
