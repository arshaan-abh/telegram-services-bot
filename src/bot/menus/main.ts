import { Menu } from "@grammyjs/menu";

import { env } from "../../config/env.js";
import type { BotContext } from "../context.js";
import { sendAuditQuickView, sendPendingOrders } from "../handlers/admin.js";
import {
  sendMyServices,
  sendReferral,
  sendServicesList,
  sendWallet,
} from "../handlers/user.js";

export const mainMenu = new Menu<BotContext>("main-menu")
  .text(
    (ctx) => ctx.t("menu-services"),
    async (ctx) => {
      await ctx.answerCallbackQuery();
      await sendServicesList(ctx, 0);
    },
  )
  .row()
  .text(
    (ctx) => ctx.t("menu-my-services"),
    async (ctx) => {
      await ctx.answerCallbackQuery();
      await sendMyServices(ctx);
    },
  )
  .text(
    (ctx) => ctx.t("menu-wallet"),
    async (ctx) => {
      await ctx.answerCallbackQuery();
      await sendWallet(ctx);
    },
  )
  .row()
  .text(
    (ctx) => ctx.t("menu-referral"),
    async (ctx) => {
      await ctx.answerCallbackQuery();
      await sendReferral(ctx);
    },
  )
  .url((ctx) => ctx.t("menu-channel"), env.MAIN_CHANNEL_URL)
  .row()
  .text(
    (ctx) => ctx.t("menu-admin"),
    async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.isAdmin) {
        await ctx.reply(ctx.t("admin-denied"));
        return;
      }

      await ctx.reply(ctx.t("admin-menu"), { reply_markup: adminMenu });
    },
  );

export const adminMenu = new Menu<BotContext>("admin-menu")
  .text("Pending Orders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendPendingOrders(ctx);
  })
  .row()
  .text("Create Service", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("createServiceConversation");
  })
  .text("Edit Service", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("editServiceConversation");
  })
  .text("Deactivate Service", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("deactivateServiceConversation");
  })
  .row()
  .text("Create Discount", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("createDiscountConversation");
  })
  .text("Edit Discount", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("editDiscountConversation");
  })
  .row()
  .text("Notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("adminNotificationConversation");
  })
  .text("Audit", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendAuditQuickView(ctx);
  });

mainMenu.register(adminMenu);
