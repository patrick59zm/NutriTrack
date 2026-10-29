import { Platform } from 'react-native';

import { t } from './i18n';
import { reminderPlan } from './reminder-plan';
import { loadReceipts, loadSettings } from './storage';
import type { Receipt } from './types';

export { REMINDER_HOURS, reminderPlan, reminderTime } from './reminder-plan';

// One daily reminder, at 17:00, on days when something in the kitchen is about to go off.
// Opt-in from Settings; nothing is scheduled until the person turns it on.

const CHANNEL = 'use-soon';

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
        name: t('reminder.channel'),
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

/**
 * Calls `handler` when the person taps a reminder, including the tap that started the
 * app. Returns a function that stops listening.
 */
export function onReminderTap(handler: () => void) {
  if (!supported) return () => {};
  let stopped = false;
  let remove = () => {};
  notifications()
    .then(async (N) => {
      if (stopped) return;
      const subscription = N.addNotificationResponseReceivedListener(() => handler());
      remove = () => subscription.remove();
      const last = await N.getLastNotificationResponseAsync();
      if (last && !stopped) handler();
    })
    .catch(() => {});
  return () => {
    stopped = true;
    remove();
  };
}

/** Re-plans reminders from what is stored; call after anything in the kitchen changes. */
export async function syncReminders() {
  if (!supported) return;
  try {
    const [receipts, settings] = await Promise.all([loadReceipts(), loadSettings()]);
    await refreshReminders(receipts, settings.remindersEnabled, settings.reminderHour);
  } catch {}
}

/** Replaces all scheduled reminders with the current plan. No-op when reminders are off. */
export async function refreshReminders(receipts: Receipt[], enabled: boolean, hour?: number) {
  if (!supported) return;
  try {
    const N = await notifications();
    await N.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    for (const entry of reminderPlan(receipts, new Date(), hour)) {
      const names =
        entry.items.slice(0, 4).join(', ') + (entry.items.length > 4 ? t('reminder.andMore', { n: entry.items.length - 4 }) : '');
      await N.scheduleNotificationAsync({
        content: {
          title: t('reminder.title', { n: entry.items.length }),
          body: t('reminder.body', { names }),
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: entry.date, channelId: CHANNEL },
      });
    }
  } catch {}
}
