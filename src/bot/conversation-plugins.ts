import type { Middleware } from "grammy";

import type { ConversationContext } from "./context.js";
import { i18n } from "./i18n.js";
import { enrichConversationContext } from "./middleware.js";

export function buildConversationPlugins(): Middleware<ConversationContext>[] {
  return [i18n, enrichConversationContext];
}
