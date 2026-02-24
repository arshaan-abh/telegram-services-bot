import type { MiddlewareFn } from "grammy";

import { env } from "../config/env.js";
import { upsertTelegramUser } from "../db/repositories/users.js";
import { checkRateLimit } from "../security/rate-limit.js";
import type { BotContext } from "./context.js";

export const enrichUserContext: MiddlewareFn<BotContext> = async (
  ctx,
  next,
) => {
  const from = ctx.from;
  if (!from) {
    return next();
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
