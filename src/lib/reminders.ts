import { Platform } from 'react-native';

import { pantryFrom } from './nutrition';
import { loadReceipts, loadSettings } from './storage';
import type { Receipt } from './types';

// One daily reminder, at 17:00, on days when something in the kitchen is about to go off.
// Opt-in from Settings; nothing is scheduled until the person turns it on.

const CHANNEL = 'use-soon';
const HOUR = 17;
const DAYS_AHEAD = 7;

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

async function notifications() {
  return import('expo-notifications');
}

/** Asks for permission; resolves to whether reminders may be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const N = await notifications();
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, {
        name: 'Food to use soon',
        importance: N.AndroidImportance.DEFAULT,
        sound: null,
      });
    }
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await N.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Shows reminders as banners even while the app is open. Safe to call at start-up. */
export async function prepareReminders() {
  if (!supported) return;
  try {
    const N = await notifications();
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

/** The lines a reminder would say for each of the next days, for display and scheduling. */
export function reminderPlan(receipts: Receipt[], now = new Date()) {
  const pantry = pantryFrom(receipts, 60, now);
  const plan: { date: Date; items: string[] }[] = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, HOUR, 0, 0);
    if (date.getTime() <= now.getTime()) continue;
    // Items whose last good day is this day or the next: "use today or tomorrow".
    const items = pantry.filter((p) => p.daysLeft - d >= 0 && p.daysLeft - d <= 1).map((p) => p.name);
    if (items.length) plan.push({ date, items: [...new Set(items)] });
  }
  return plan;
}

/** Re-plans reminders from what is stored; call after anything in the kitchen changes. */
export async function syncReminders() {
  if (!supported) return;
  try {
    const [receipts, settings] = await Promise.all([loadReceipts(), loadSettings()]);
    await refreshReminders(receipts, settings.remindersEnabled);
  } catch {}
}

/** Replaces all scheduled reminders with the current plan. No-op when reminders are off. */
export async function refreshReminders(receipts: Receipt[], enabled: boolean) {
  if (!supported) return;
  try {
    const N = await notifications();
    await N.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    for (const entry of reminderPlan(receipts)) {
      const names = entry.items.slice(0, 4).join(', ') + (entry.items.length > 4 ? ` and ${entry.items.length - 4} more` : '');
      await N.scheduleNotificationAsync({
        content: {
          title: entry.items.length === 1 ? 'Use it soon' : `${entry.items.length} things to use soon`,
          body: `${names}. Open NutriTrack for recipe ideas.`,
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: entry.date, channelId: CHANNEL },
      });
    }
  } catch {}
}
