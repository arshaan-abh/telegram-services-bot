import type { MiddlewareFn } from "grammy";

import { env } from "../config/env.js";
import { upsertTelegramUser } from "../db/repositories/users.js";
import { checkRateLimit } from "../security/rate-limit.js";
import type { BotContext, ConversationContext } from "./context.js";

type EnrichedContext = {
  from?: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  };
  dbUserId?: string;
  isAdmin: boolean;
};

async function hydrateUserContext(
  ctx: EnrichedContext,
  next: () => Promise<void>,
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await next();
    return;
  }

  const dbUser = await upsertTelegramUser({
    telegramId: String(from.id),
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
  });

  ctx.dbUserId = dbUser.id;
  ctx.isAdmin = String(from.id) === env.ADMIN_TELEGRAM_ID;

  await next();
}

export const enrichUserContext: MiddlewareFn<BotContext> = async (
  ctx,
  next,
) => {
  await hydrateUserContext(ctx, next);
};

export const globalRateLimit: MiddlewareFn<BotContext> = async (ctx, next) => {
  const from = ctx.from;
  if (!from) {
    return next();
  }

  const key = `tg:${from.id}`;
  const result = await checkRateLimit("global", key);
  if (!result.success) {
    await ctx.reply(ctx.t("rate-limit"));
    return;
  }

  await next();
};

export const enrichConversationContext: MiddlewareFn<
  ConversationContext
> = async (ctx, next) => {
  await hydrateUserContext(ctx, next);
};
