import { addDays, isBefore } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function calculateSubscriptionEnd(
  startedAt: Date,
  durationDays: number,
): Date {
  return addDays(startedAt, durationDays);
}

export function shouldScheduleReminder(sendAt: Date, now: Date): boolean {
  return isBefore(now, sendAt);
}

export function formatDateForUser(
  date: Date,
  timezone: string,
  locale: string,
): string {
  const format = locale === "fa" ? "yyyy/MM/dd HH:mm" : "yyyy-MM-dd HH:mm";
  return formatInTimeZone(date, timezone, format);
}
