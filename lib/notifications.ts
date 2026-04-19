import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ─── Foreground handler ───────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Channel IDs ──────────────────────────────────────────────────────────────
const CHANNELS = {
  reminders: 'displyn-reminders',
  streaks:   'displyn-streaks',
  summary:   'displyn-summary',
};

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEYS = {
  settings: 'displyn_notification_settings',
  scheduled: 'displyn_scheduled_ids',
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface NotificationSettings {
  notifications_enabled: boolean;
  morning_reminder_time: string;    // 'HH:MM'
  evening_reminder_time: string;    // 'HH:MM'
  daily_summary_enabled: boolean;
  daily_summary_time: string;       // 'HH:MM'
  streak_notifications_enabled: boolean;
  overdue_notifications_enabled: boolean;
  reminder_minutes_before: number;
  push_token: string | null;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  notifications_enabled: true,
  morning_reminder_time: '09:00',
  evening_reminder_time: '20:00',
  daily_summary_enabled: true,
  daily_summary_time: '20:00',
  streak_notifications_enabled: true,
  overdue_notifications_enabled: true,
  reminder_minutes_before: 30,
  push_token: null,
};

// ─── Permission + channel setup ───────────────────────────────────────────────
async function setupChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7072DD',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.streaks, {
    name: 'Streak Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#F59E0B',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.summary, {
    name: 'Daily Summary',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#7072DD',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    await setupChannels();
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    await setupChannels();
    return true;
  }
  return false;
}

// ─── Main init — replaces registerForPushNotifications ───────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    // Load settings and schedule local notifications
    const settings = await getNotificationSettings('local');
    await scheduleAllLocalNotifications(settings);

    console.log('[Notifications] Local notifications scheduled ✅');
    return 'local';
  } catch (e: any) {
    console.error('[Notifications] Setup failed:', e.message);
    return null;
  }
}

// ─── Parse HH:MM ─────────────────────────────────────────────────────────────
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h || 9, minute: m || 0 };
}

// ─── Cancel all scheduled local notifications ─────────────────────────────────
async function cancelAllScheduled() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.scheduled);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    }
    // Also cancel everything just in case
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(KEYS.scheduled);
  } catch {}
}

// ─── Schedule all recurring local notifications ───────────────────────────────
export async function scheduleAllLocalNotifications(settings: NotificationSettings) {
  await cancelAllScheduled();
  if (!settings.notifications_enabled) return;

  const scheduled: string[] = [];

  // Morning reminder
  const morning = parseTime(settings.morning_reminder_time);
  const morningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Good morning! ☀️",
      body: "Check in with Nyla and review today's tasks.",
      sound: true,
      categoryIdentifier: CHANNELS.reminders,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: morning.hour,
      minute: morning.minute,
    },
  });
  scheduled.push(morningId);

  // Evening reminder
  const evening = parseTime(settings.evening_reminder_time);
  const eveningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Evening check-in 🌙",
      body: "How did today go? Reflect and log your progress with Nyla.",
      sound: true,
      categoryIdentifier: CHANNELS.reminders,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: evening.hour,
      minute: evening.minute,
    },
  });
  scheduled.push(eveningId);

  // Daily summary
  if (settings.daily_summary_enabled) {
    const summary = parseTime(settings.daily_summary_time);
    const summaryId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your daily summary 📊",
        body: "Open Displyn to see how you did today.",
        sound: false,
        categoryIdentifier: CHANNELS.summary,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: summary.hour,
        minute: summary.minute,
      },
    });
    scheduled.push(summaryId);
  }

  // Streak protection — fires at 10pm if streak notifications enabled
  if (settings.streak_notifications_enabled) {
    const streakId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔥 Don't break your streak!",
        body: "You still have tasks to complete today. Keep it up!",
        sound: true,
        categoryIdentifier: CHANNELS.streaks,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 22,
        minute: 0,
      },
    });
    scheduled.push(streakId);
  }

  await AsyncStorage.setItem(KEYS.scheduled, JSON.stringify(scheduled));
  console.log(`[Notifications] ${scheduled.length} local notifications scheduled`);
}

// ─── One-off notification for task milestone ──────────────────────────────────
export async function sendTaskCompletionNotification(taskTitle: string, streak: number) {
  try {
    if (streak > 0 && streak % 7 === 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🏆 ${streak}-day streak on "${taskTitle}"!`,
          body: 'Incredible consistency. Nyla is proud of you.',
          sound: true,
        },
        trigger: null, // Show immediately
      });
    }
  } catch {}
}

// ─── Settings — read from AsyncStorage + Supabase profile ────────────────────
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  // Try Supabase first
  try {
    if (userId !== 'local') {
      const { data } = await supabase
        .from('profiles')
        .select(`
          notifications_enabled, morning_reminder_time, evening_reminder_time,
          overdue_notifications_enabled, streak_notifications_enabled,
          daily_summary_enabled, daily_summary_time, reminder_minutes_before
        `)
        .eq('id', userId)
        .single();

      if (data) {
        const settings: NotificationSettings = {
          notifications_enabled: data.notifications_enabled ?? true,
          morning_reminder_time: data.morning_reminder_time ?? '09:00',
          evening_reminder_time: data.evening_reminder_time ?? '20:00',
          overdue_notifications_enabled: data.overdue_notifications_enabled ?? true,
          streak_notifications_enabled: data.streak_notifications_enabled ?? true,
          daily_summary_enabled: data.daily_summary_enabled ?? true,
          daily_summary_time: data.daily_summary_time ?? '20:00',
          reminder_minutes_before: data.reminder_minutes_before ?? 30,
          push_token: null,
        };
        // Cache locally
        await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
        return settings;
      }
    }
  } catch {}

  // Fall back to local cache
  try {
    const cached = await AsyncStorage.getItem(KEYS.settings);
    if (cached) return JSON.parse(cached);
  } catch {}

  return DEFAULT_SETTINGS;
}

export async function updateNotificationSettings(
  settings: Partial<Omit<NotificationSettings, 'push_token'>>
): Promise<void> {
  try {
    // Update Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update(settings).eq('id', user.id);
    }
    // Update local cache
    const current = await getNotificationSettings(user?.id || 'local');
    const merged = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(merged));
    // Reschedule with new settings
    await scheduleAllLocalNotifications(merged);
  } catch (e: any) {
    console.error('[Notifications] Update failed:', e.message);
  }
}

// ─── Legacy stubs — kept for compatibility with existing code ─────────────────
export type NotificationEventType =
  | 'morning' | 'evening' | 'overdue' | 'procrastination_alert';

export async function hasNotificationEvent(
  userId: string, eventType: NotificationEventType, eventDate: string
): Promise<boolean> { return false; }

export async function logNotificationEvent(params: {
  userId: string; eventType: NotificationEventType;
  eventDate: string; metadata?: Record<string, any>;
}): Promise<void> {}

export async function getDailyRescheduledSkipsCount(
  userId: string, date: string
): Promise<number> { return 0; }