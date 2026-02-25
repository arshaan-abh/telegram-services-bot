import {
  listActiveSubscriptions,
  updateSubscriptionDuration,
} from "../db/repositories/subscriptions.js";
import { calculateSubscriptionEnd } from "../utils/date.js";

export function isSubscriptionExpired(
  startedAt: Date,
  durationDays: number,
  now: Date,
): boolean {
  const endAt = calculateSubscriptionEnd(startedAt, durationDays);
  return endAt <= now;
}

export async function reconcileExpiredSubscriptions(
  now: Date = new Date(),
): Promise<number> {
  const active = await listActiveSubscriptions();
  let updatedCount = 0;

  for (const subscription of active) {
    if (
      !isSubscriptionExpired(
        subscription.startedAt,
        subscription.durationDays,
        now,
      )
    ) {
      continue;
    }

    const updated = await updateSubscriptionDuration(subscription.id, {
      status: "expired",
    });
    if (updated) {
      updatedCount += 1;
    }
  }

  return updatedCount;
}
