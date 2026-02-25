import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot, session } from "grammy";

import { createRedisSessionStorage } from "../adapters/session-storage.js";
import { env } from "../config/env.js";
import { getOrderWithUserAndService } from "../db/repositories/orders.js";
import { childLogger } from "../observability/logger.js";
import { initSentry, Sentry } from "../observability/sentry.js";
import { reserveIdempotencyKey } from "../security/idempotency.js";
import { checkRateLimit } from "../security/rate-limit.js";
import { approveOrderByAdmin } from "../services/orders.js";
import {
  linkReferralIfEligible,
  parseReferralToken,
} from "../services/referrals.js";
import { calculateSubscriptionEnd, formatDateForUser } from "../utils/date.js";
import type { BotContext } from "./context.js";
import { initialSession } from "./context.js";
import { buyConversation } from "./conversations/buy.js";
import {
  createDiscountConversation,
  editDiscountConversation,
} from "./conversations/discount-admin.js";
import { dismissOrderConversation } from "./conversations/dismiss-order.js";
import { adminNotificationConversation } from "./conversations/notification-admin.js";
import {
  createServiceConversation,
  deactivateServiceConversation,
  editServiceConversation,
} from "./conversations/service-admin.js";
import { ensureAdmin, sendPendingOrders } from "./handlers/admin.js";
import {
  sendMyServices,
  sendReferral,
  sendServiceDetails,
  sendServicesList,
  sendWallet,
} from "./handlers/user.js";
import { i18n } from "./i18n.js";
import { adminMenu, mainMenu } from "./menus/main.js";
import { enrichUserContext, globalRateLimit } from "./middleware.js";

initSentry();

const globalBot = globalThis as typeof globalThis & {
  __telegramServicesBot?: Bot<BotContext>;
};

function parseCallbackData(data: string) {
  const parts = data.split(":");
  return parts;
}

async function passAdminThrottle(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    return false;
  }

  const result = await checkRateLimit("admin", `admin:${telegramId}`);
  if (!result.success) {
    await ctx.reply(ctx.t("rate-limit"));
    return false;
  }

  return true;
}

function buildBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);

  bot.use(async (ctx, next) => {
    ctx.isAdmin = false;
    await next();
  });

  bot.use(
    session({
      initial: initialSession,
      storage: createRedisSessionStorage("bot:session"),
      getSessionKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
    }),
  );

  bot.use(i18n);
  bot.use(enrichUserContext);
  bot.use(globalRateLimit);

  bot.use(async (ctx, next) => {
    const callbackId = ctx.callbackQuery?.id;
    if (!callbackId) {
      await next();
      return;
    }

    const reserved = await reserveIdempotencyKey(`cbq:${callbackId}`, 600);
    if (!reserved) {
      await ctx.answerCallbackQuery({
        text: ctx.t("action-already-processed"),
      });
      return;
    }

    await next();
  });

  bot.use(async (ctx, next) => {
    const logger = childLogger({
      updateId: ctx.update.update_id,
      telegramId: ctx.from?.id ?? "unknown",
      isAdmin: ctx.isAdmin,
    });

    try {
      await next();
    } catch (error) {
      logger.error({ err: error }, "update_failed");
      Sentry.captureException(error);
      await ctx.reply(ctx.t("error-generic"));
    }
  });

  bot.use(mainMenu);
  bot.use(adminMenu);

  bot.use(conversations());
  bot.use(createConversation(buyConversation));
  bot.use(createConversation(dismissOrderConversation));
  bot.use(createConversation(createServiceConversation));
  bot.use(createConversation(editServiceConversation));
  bot.use(createConversation(deactivateServiceConversation));
  bot.use(createConversation(createDiscountConversation));
  bot.use(createConversation(editDiscountConversation));
  bot.use(createConversation(adminNotificationConversation));

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() || undefined;

    if (ctx.dbUserId) {
      const referralToken = parseReferralToken(payload);
      if (referralToken) {
        await linkReferralIfEligible(ctx.dbUserId, referralToken);
      }
    }

    await ctx.reply(ctx.t("welcome", { botName: env.BOT_NAME }), {
      reply_markup: mainMenu,
    });
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply(ctx.t("main-menu"), { reply_markup: mainMenu });
  });

  bot.command("services", async (ctx) => {
    await sendServicesList(ctx, 0);
  });

  bot.command("my_services", async (ctx) => {
    await sendMyServices(ctx);
  });

  bot.command("wallet", async (ctx) => {
    await sendWallet(ctx);
  });

  bot.command("referral", async (ctx) => {
    await sendReferral(ctx);
  });

  bot.command("admin", async (ctx) => {
    if (!ensureAdmin(ctx)) {
      return;
    }
    if (!(await passAdminThrottle(ctx))) {
      return;
    }

    await ctx.reply(ctx.t("admin-menu"), {
      reply_markup: adminMenu,
    });
  });

  bot.callbackQuery(/^v1:svc:list:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = Number(ctx.match[1]);
    await sendServicesList(ctx, page);
  });

  bot.callbackQuery(/^v1:svc:view:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    const serviceId = ctx.match[1];
    if (!serviceId) {
      await ctx.reply(ctx.t("unknown-action"));
      return;
    }
    await sendServiceDetails(ctx, serviceId);
  });

  bot.callbackQuery(/^v1:svc:buy:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    const serviceId = ctx.match[1];
    if (!serviceId) {
      await ctx.reply(ctx.t("unknown-action"));
      return;
    }
    await ctx.conversation.enter("buyConversation", serviceId);
  });

  bot.callbackQuery(/^v1:admin:order:view:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ensureAdmin(ctx)) {
      return;
    }
    if (!(await passAdminThrottle(ctx))) {
      return;
    }

    await sendPendingOrders(ctx);
  });

  bot.callbackQuery(/^v1:admin:order:done:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ensureAdmin(ctx)) {
      return;
    }
    if (!(await passAdminThrottle(ctx))) {
      return;
    }

    const orderId = ctx.match[1];
    if (!orderId) {
      await ctx.reply(ctx.t("unknown-action"));
      return;
    }

    const adminActionKey = `admin:done:${orderId}:${ctx.from?.id ?? "unknown"}`;
    const actionReserved = await reserveIdempotencyKey(adminActionKey, 30);
    if (!actionReserved) {
      await ctx.reply(ctx.t("action-already-processed"));
      return;
    }

    const approved = await approveOrderByAdmin(orderId, String(ctx.from?.id));
    const orderWithUser = await getOrderWithUserAndService(orderId);
    if (!orderWithUser) {
      await ctx.reply(ctx.t("error-generic"));
      return;
    }

    const expiry = formatDateForUser(
      calculateSubscriptionEnd(approved.startedAt, approved.durationDays),
      env.APP_TIMEZONE,
      env.BOT_LANGUAGE,
    );

    await ctx.api.sendMessage(
      orderWithUser.user.telegramId,
      ctx.t("admin-order-approved-user", { expiry }),
    );

    await ctx.reply(ctx.t("admin-done-confirmed"));
  });

  bot.callbackQuery(/^v1:admin:order:dismiss:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ensureAdmin(ctx)) {
      return;
    }
    if (!(await passAdminThrottle(ctx))) {
      return;
    }

    const orderId = ctx.match[1];
    if (!orderId) {
      await ctx.reply(ctx.t("unknown-action"));
      return;
    }

    const adminActionKey = `admin:dismiss:${orderId}:${ctx.from?.id ?? "unknown"}`;
    const actionReserved = await reserveIdempotencyKey(adminActionKey, 30);
    if (!actionReserved) {
      await ctx.reply(ctx.t("action-already-processed"));
      return;
    }

    await ctx.conversation.enter("dismissOrderConversation", orderId);
  });

  bot.callbackQuery(/^v1:admin:order:contact:([a-z0-9-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ensureAdmin(ctx)) {
      return;
    }
    if (!(await passAdminThrottle(ctx))) {
      return;
    }

    const orderId = ctx.match[1];
    if (!orderId) {
      await ctx.reply(ctx.t("unknown-action"));
      return;
    }

    const order = await getOrderWithUserAndService(orderId);
    if (!order) {
      await ctx.reply(ctx.t("error-generic"));
      return;
    }

    const link = `tg://user?id=${order.user.telegramId}`;
    await ctx.reply(
      `User info:\nTelegram ID: ${order.user.telegramId}\nUsername: ${order.user.username ?? "-"}\nName: ${order.user.firstName}\nDirect: ${link}`,
    );
  });

  bot.callbackQuery("noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.on("callback_query:data", async (ctx) => {
    const [version] = parseCallbackData(ctx.callbackQuery.data);
    if (version !== "v1") {
      await ctx.answerCallbackQuery({
        text: ctx.t("unknown-action"),
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: ctx.t("unknown-action") });
  });

  bot.on("message", async (ctx, next) => {
    if (ctx.message.text?.startsWith("/")) {
      return next();
    }

    await next();
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      return;
    }

    await ctx.reply(ctx.t("unknown-command"));
  });

  return bot;
}

export function getBot(): Bot<BotContext> {
  if (!globalBot.__telegramServicesBot) {
    globalBot.__telegramServicesBot = buildBot();
  }

  return globalBot.__telegramServicesBot;
}
