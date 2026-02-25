import { InlineKeyboard } from "grammy";

import { CALLBACKS } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { getCreditBalance } from "../../db/repositories/credits.js";
import {
  getServiceById,
  listActiveServices,
} from "../../db/repositories/services.js";
import { listSubscriptionsByUser } from "../../db/repositories/subscriptions.js";
import { getUserById } from "../../db/repositories/users.js";
import { reconcileExpiredSubscriptions } from "../../services/subscriptions.js";
import type { BotContext } from "../context.js";
import { formatSubscriptionLine, withProcessingMessage } from "../messages.js";

const PAGE_SIZE = 5;

export async function sendServicesList(
  ctx: BotContext,
  page = 0,
): Promise<void> {
  await withProcessingMessage(ctx, async () => {
    const services = await listActiveServices();
    if (services.length === 0) {
      await ctx.reply(ctx.t("services-empty"));
      return;
    }

    const pages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), pages - 1);
    const slice = services.slice(
      safePage * PAGE_SIZE,
      safePage * PAGE_SIZE + PAGE_SIZE,
    );

    const keyboard = new InlineKeyboard();
    for (const service of slice) {
      keyboard.text(service.title, CALLBACKS.serviceView(service.id)).row();
    }

    if (pages > 1) {
      if (safePage > 0) {
        keyboard.text("<", CALLBACKS.servicesList(safePage - 1));
      }
      keyboard.text(`${safePage + 1}/${pages}`, "noop");
      if (safePage < pages - 1) {
        keyboard.text(">", CALLBACKS.servicesList(safePage + 1));
      }
    }

    await ctx.reply(ctx.t("services-title"), {
      reply_markup: keyboard,
    });
  });
}

export async function sendServiceDetails(
  ctx: BotContext,
  serviceId: string,
): Promise<void> {
  await withProcessingMessage(ctx, async () => {
    const service = await getServiceById(serviceId);
    if (!service || !service.isActive) {
      await ctx.reply(ctx.t("services-empty"));
      return;
    }

    const description = service.description ?? "";
    const notes =
      service.notes.length > 0
        ? `\n\n${ctx.t("service-notes-title")}\n- ${service.notes.join("\n- ")}`
        : "";
    const details =
      ctx.t("service-details", {
        title: service.title,
        price: service.price,
        unit: env.PRICE_UNIT,
        duration: service.durationDays,
        description,
      }) + notes;

    const keyboard = new InlineKeyboard().text(
      ctx.t("buy-button"),
      CALLBACKS.serviceBuy(service.id),
    );

    await ctx.reply(details, {
      reply_markup: keyboard,
    });
  });
}

export async function sendMyServices(ctx: BotContext): Promise<void> {
  if (!ctx.dbUserId) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  await reconcileExpiredSubscriptions();

  const subscriptions = await listSubscriptionsByUser(ctx.dbUserId);
  if (subscriptions.length === 0) {
    await ctx.reply(ctx.t("my-services-empty"));
    return;
  }

  const locale = env.BOT_LANGUAGE;
  const lines = subscriptions.map((entry) =>
    formatSubscriptionLine({
      title: entry.service.title,
      startedAt: entry.subscription.startedAt,
      durationDays: entry.subscription.durationDays,
      statusLabel:
        entry.subscription.status === "active"
          ? ctx.t("my-services-status-active")
          : ctx.t("my-services-status-expired"),
      locale,
    }),
  );

  await ctx.reply(`${ctx.t("my-services-title")}\n${lines.join("\n")}`);
}

export async function sendWallet(ctx: BotContext): Promise<void> {
  if (!ctx.dbUserId) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  const balance = await getCreditBalance(ctx.dbUserId);
  await ctx.reply(
    ctx.t("wallet-balance", {
      balance,
      unit: env.PRICE_UNIT,
    }),
  );
}

export async function sendReferral(ctx: BotContext): Promise<void> {
  if (!ctx.dbUserId) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  const user = await getUserById(ctx.dbUserId);
  if (!user) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  const balance = await getCreditBalance(user.id);
  const inviteLink = `https://t.me/${env.BOT_NAME}?start=ref_${user.referralToken}`;

  await ctx.reply(
    `${ctx.t("referral-link")}\n${inviteLink}\n\n${ctx.t("referral-balance", { balance, unit: env.PRICE_UNIT })}`,
  );
}
