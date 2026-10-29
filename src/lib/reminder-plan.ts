import { pantryFrom } from './nutrition';
import type { Receipt } from './types';

export const REMINDER_HOUR = 17;
const DAYS_AHEAD = 7;

/** The lines a reminder would say for each of the next days, for display and scheduling. */
export function reminderPlan(receipts: Receipt[], now = new Date()) {
  const pantry = pantryFrom(receipts, 60, now);
  const plan: { date: Date; items: string[] }[] = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, REMINDER_HOUR, 0, 0);
    if (date.getTime() <= now.getTime()) continue;
    // Items whose last good day is this day or the next: "use today or tomorrow".
    const items = pantry.filter((p) => p.daysLeft - d >= 0 && p.daysLeft - d <= 1).map((p) => p.name);
    if (items.length) plan.push({ date, items: [...new Set(items)] });
  }
  return plan;
}
