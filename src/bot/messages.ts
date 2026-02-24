import { env } from "../config/env.js";
import { formatDateForUser } from "../utils/date.js";
import { escapeMarkdown } from "../utils/telegram.js";

export function formatNeededFields(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

export function formatAdminOrderFields(values: Record<string, string>): string {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return "-";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

export function formatSubscriptionLine(input: {
  title: string;
  startedAt: Date;
  durationDays: number;
  status: "active" | "expired";
  locale: "en" | "fa";
}) {
  const started = formatDateForUser(
    input.startedAt,
    env.APP_TIMEZONE,
    input.locale,
  );
  return `- ${input.title} | ${input.status} | ${started} + ${input.durationDays}d`;
}

export function markdownSafe(text: string): string {
  return escapeMarkdown(text);
}
