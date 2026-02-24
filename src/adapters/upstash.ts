import {
  Client as QStashClient,
  Receiver as QStashReceiver,
} from "@upstash/qstash";
import { Redis } from "@upstash/redis";

import { env } from "../config/env.js";

const globalAdapters = globalThis as typeof globalThis & {
  __telegramBotRedis?: Redis;
  __telegramBotQStash?: QStashClient;
  __telegramBotQStashReceiver?: QStashReceiver;
};

export const redis =
  globalAdapters.__telegramBotRedis ??
  new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

export const qstash =
  globalAdapters.__telegramBotQStash ??
  new QStashClient({
    token: env.QSTASH_TOKEN,
  });

export const qstashReceiver =
  globalAdapters.__telegramBotQStashReceiver ??
  new QStashReceiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

if (!globalAdapters.__telegramBotRedis) {
  globalAdapters.__telegramBotRedis = redis;
}

if (!globalAdapters.__telegramBotQStash) {
  globalAdapters.__telegramBotQStash = qstash;
}

if (!globalAdapters.__telegramBotQStashReceiver) {
  globalAdapters.__telegramBotQStashReceiver = qstashReceiver;
}
