import type { ConversationFlavor } from "@grammyjs/conversations";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { SessionFlavor } from "grammy";
import { Context } from "grammy";

export type DismissDraft = {
  orderId: string;
  reason?: string;
};

export type SessionData = {
  dismissDraft?: DismissDraft;
};

type BaseContext = Context &
  SessionFlavor<SessionData> &
  I18nFlavor & {
    isAdmin: boolean;
    dbUserId?: string;
    requestId?: string;
  };

export type BotContext = BaseContext & ConversationFlavor<BaseContext>;

export function initialSession(): SessionData {
  return {};
}
