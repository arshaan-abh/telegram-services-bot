import { I18n } from "@grammyjs/i18n";

import { env } from "../config/env.js";

export const i18n = new I18n({
  defaultLocale: env.BOT_LANGUAGE,
  directory: "locales",
  useSession: false,
  localeNegotiator: () => env.BOT_LANGUAGE,
});
