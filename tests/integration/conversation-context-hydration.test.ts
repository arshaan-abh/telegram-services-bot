import {
  Conversation,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { Bot } from "grammy";
import type { Update } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsertTelegramUserMock } = vi.hoisted(() => ({
  upsertTelegramUserMock: vi.fn(),
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  upsertTelegramUser: upsertTelegramUserMock,
}));

import type { BotContext, ConversationContext } from "../../src/bot/context.js";
import { buildConversationPlugins } from "../../src/bot/conversation-plugins.js";

type ConversationSnapshot = {
  hasTranslator: boolean;
  isAdmin: boolean;
  dbUserId?: string;
};

let snapshot: ConversationSnapshot | undefined;

function probeConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): void {
  void conversation;
  snapshot = {
    hasTranslator: typeof ctx.t === "function",
    isAdmin: ctx.isAdmin,
    dbUserId: ctx.dbUserId,
  };
}

function createProbeUpdate(updateId: number): Update {
  const adminId = Number(process.env.ADMIN_TELEGRAM_ID);
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1_772_222_020,
      chat: {
        id: adminId,
        type: "private",
        first_name: "Admin",
      },
      from: {
        id: adminId,
        is_bot: false,
        first_name: "Admin",
      },
      text: "/probe",
      entities: [
        {
          offset: 0,
          length: 6,
          type: "bot_command",
        },
      ],
    },
  };
}

describe("conversation context hydration", () => {
  beforeEach(() => {
    upsertTelegramUserMock.mockReset();
    upsertTelegramUserMock.mockResolvedValue({ id: "db-user-1" });
    snapshot = undefined;
  });

  it("hydrates i18n and user fields inside conversations", async () => {
    const bot = new Bot<BotContext>(process.env.BOT_TOKEN!, {
      botInfo: {
        id: 999_001,
        is_bot: true,
        first_name: "TestBot",
        username: "test_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
      },
    });

    bot.use(async (ctx, next) => {
      ctx.isAdmin = false;
      await next();
    });

    bot.use(
      conversations<BotContext, ConversationContext>({
        plugins: buildConversationPlugins(),
      }),
    );
    bot.use(createConversation(probeConversation));
    bot.command("probe", async (ctx) => {
      await ctx.conversation.enter("probeConversation");
    });

    await bot.handleUpdate(createProbeUpdate(1));

    expect(snapshot).toEqual({
      hasTranslator: true,
      isAdmin: true,
      dbUserId: "db-user-1",
    });
  });
});
