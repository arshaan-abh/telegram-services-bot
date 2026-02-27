import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { I18n } from "@grammyjs/i18n";

import { env } from "../config/env.js";

export function resolveLocalesDirectory(moduleUrl = import.meta.url): string {
  const modulePath = fileURLToPath(moduleUrl);
  return resolve(dirname(modulePath), "../../locales");
}

export const i18n = new I18n({
  defaultLocale: env.BOT_LANGUAGE,
  directory: resolveLocalesDirectory(),
  useSession: false,
  localeNegotiator: () => env.BOT_LANGUAGE,
});
