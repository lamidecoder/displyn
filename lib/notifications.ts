import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const IS_EXPO_GO = Constants.appOwnership === 'expo';
const LOCAL_COMPLETIONS_KEY = 'displyn_local_completions';
if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ─── Build a fresh personalised message right now ────────────────────────────
async function buildLiveNotificationMessage(
  time: 'morning' | 'evening' | 'streak',
  userId: string
): Promise<{ title: string; body: string } | null> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [profileRes, instancesRes] = await Promise.all([
      supabase.from('profiles').select('display_name, notification_tone').eq('id', userId).single(),
      supabase.from('task_instances')
        .select('id, status, task:tasks(title)')
        .eq('user_id', userId)
        .eq('scheduled_date', today),
    ]);

    const name = profileRes.data?.display_name?.split(' ')[0] || 'there';
    const tone = profileRes.data?.notification_tone || 'soft_coach';

    // Overlay AsyncStorage completions so we use the real state
    const localRaw = await AsyncStorage.getItem(LOCAL_COMPLETIONS_KEY);
    const local: Record<string, any> = localRaw ? JSON.parse(localRaw) : {};

    const pending = (instancesRes.data || []).filter((i: any) => {
      if (local[i.id]) return false; // completed locally
      return i.status === 'pending';
    });

    const count = pending.length;
    const titles = pending.slice(0, 2).map((i: any) => i.task?.title).filter(Boolean);
    const taskRef = titles.length > 0 ? `, including ${titles.join(' and ')}` : '';

    const toneKey = tone === 'savage_mode' ? 'savage'
      : tone === 'strict_mentor' ? 'strict'
      : tone === 'comedic' ? 'comedic'
      : tone === 'silent' ? 'silent'
      : 'soft';

    type ToneMap = { soft: string; strict: string; savage: string; comedic: string; silent: string };

    const messages: Record<string, Record<string, ToneMap>> = {
      morning: {
        none: {
          soft: `You have a clean slate today, ${name}. Let's make it count 💪`,
          strict: `No tasks yet, ${name}. A focused day starts with intention.`,
          savage: `Nothing planned? Don't waste the day, ${name}.`,
          comedic: `Wow ${name}, no tasks? Are you on holiday? 😄`,
          silent: `Today's slate is clear.`,
        },
        some: {
          soft: `You have ${count} task${count > 1 ? 's' : ''} today${taskRef}. You can do this.`,
          strict: `${count} task${count > 1 ? 's' : ''} waiting${taskRef}. Let's get through them, ${name}.`,
          savage: `${count} tasks. Time to get moving${taskRef}.`,
          comedic: `${count} tasks on deck${taskRef}. Time to be the legend you are, ${name} 💪`,
          silent: `${count} task${count > 1 ? 's' : ''} scheduled today.`,
        },
      },
      evening: {
        none: {
          soft: `All done today, ${name}! All tasks done today 🎉`,
          strict: `All tasks done, ${name}. Maintain this standard.`,
          savage: `All done, ${name}. Set yourself up for tomorrow.`,
          comedic: `Zero tasks pending?! Who ARE you? 😂`,
          silent: `All clear for today.`,
        },
        some: {
          soft: `Still ${count} task${count > 1 ? 's' : ''} left${taskRef}. You still have time, ${name}!`,
          strict: `${count} unfinished task${count > 1 ? 's' : ''}${taskRef}. Get them done before bed.`,
          savage: `${count} tasks still pending${taskRef}. Looks like today got busy, ${name}?`,
          comedic: `${count} tasks are still laughing at you${taskRef}. Show them! 😅`,
          silent: `${count} task${count > 1 ? 's' : ''} still pending.`,
        },
      },
      streak: {
        none: {
          soft: `Streak protected, ${name}! Rest well tonight 🌙`,
          strict: `Streak protected, ${name}. Good discipline.`,
          savage: `Clean day, ${name}. Don't slack tomorrow.`,
          comedic: `Nothing to do! Enjoy the rare peace, ${name} 😌`,
          silent: `No pending tasks.`,
        },
        some: {
          soft: `${name}, still ${count} task${count > 1 ? 's' : ''} left${taskRef}. Don't break your streak!`,
          strict: `Streak at risk. ${count} task${count > 1 ? 's' : ''} unfinished${taskRef}. Act now, ${name}.`,
          savage: `${count} tasks unfinished${taskRef}. Two hours left to protect your streak, ${name}.`,
          comedic: `${name}! ${count} tasks are ghosting you${taskRef}. Your streak needs CPR 🚨`,
          silent: `${count} task${count > 1 ? 's' : ''} still pending.`,
        },
      },
    };

    const bucket = count === 0 ? 'none' : 'some';
    const body = messages[time][bucket][toneKey as keyof ToneMap];

    const titles_map = {
      morning: `Good morning, ${name} ☀️`,
      evening: `Evening check-in, ${name} 🌙`,
      streak: `Don't break it, ${name} 🔥`,
    };

    return { title: titles_map[time], body };
  } catch (e: any) {
    return null;
  }
}

// ─── Register for push & schedule smart notifications ─────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO) {
    console.log('[Notifications] Skipped in Expo Go, use dev build to test');
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('displyn-default', {
        name: 'Displyn Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7072DD',
      });
      await Notifications.setNotificationChannelAsync('displyn-streaks', {
        name: 'Streak Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#F59E0B',
      });
    }

    return 'local';
  } catch (e: any) {
    return null;
  }
}

// ─── Schedule 3 daily smart triggers ─────────────────────────────────────────
// These fire at the right time, but message is built fresh on fire using
// schedulePersonalisedNotifications which is called on each app open
export async function schedulePersonalisedNotifications(userId: string): Promise<void> {
  if (IS_EXPO_GO) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Build fresh messages right now based on current task state
    const [morning, evening, streak] = await Promise.all([
      buildLiveNotificationMessage('morning', userId),
      buildLiveNotificationMessage('evening', userId),
      buildLiveNotificationMessage('streak', userId),
    ]);

    if (morning) {
      await Notifications.scheduleNotificationAsync({
        content: { title: morning.title, body: morning.body, sound: true, data: { type: 'morning', userId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
      });
    }

    if (evening) {
      await Notifications.scheduleNotificationAsync({
        content: { title: evening.title, body: evening.body, sound: true, data: { type: 'evening', userId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
      });
    }

    if (streak) {
      await Notifications.scheduleNotificationAsync({
        content: { title: streak.title, body: streak.body, sound: true, data: { type: 'streak', userId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 22, minute: 0 },
      });
    }

    console.log('[Notifications] Smart notifications scheduled ✅');
  } catch (e: any) {
    console.log('[Notifications] Schedule failed:', e?.message);
  }
}

// ─── Send immediate notification (from outside the app) ───────────────────────
// Example: await sendImmediateNotification('New feature!', 'Come check it out 🎉')
export async function sendImmediateNotification(title: string, body: string, data?: any) {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: data || {} },
      trigger: null, // fires immediately
    });
  } catch {}
}

// Stubs for compatibility
export async function getNotificationSettings(_userId: string) {
  return {
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
}
export async function updateNotificationSettings(_settings: any): Promise<void> {}
export async function hasNotificationEvent(): Promise<boolean> { return false; }
export async function logNotificationEvent(): Promise<void> {}
export async function getDailyRescheduledSkipsCount(): Promise<number> { return 0; }