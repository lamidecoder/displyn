import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { ProfileProvider } from '../lib/ProfileContext';
import { registerForPushNotifications, schedulePersonalisedNotifications } from '../lib/notifications';
import { markYesterdayTasksMissed } from '../lib/tasks';
import { ToastProvider } from '../components/Toast';

function AppWithToast() {
  const { isDark } = useTheme();
  const navState = useRootNavigationState();
  const hasInitialized = useRef(false);

  const getOnboardingKey = (userId: string) => `onboarding_completed_${userId}`;

  useEffect(() => {
    if (!navState?.key || hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      try {
        const introSeen = await AsyncStorage.getItem('displyn_intro_seen');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (!introSeen) {
            router.replace('/intro');
          } else {
            router.replace('/auth');
          }
          return;
        }

        const key = getOnboardingKey(session.user.id);
        const onboarded = await AsyncStorage.getItem(key);

        if (onboarded !== 'true') {
          router.replace('/onboarding');
        } else {
          router.replace('/');
        }

        registerForPushNotifications().catch(() => {});
        markYesterdayTasksMissed(session.user.id).catch(() => {});
        schedulePersonalisedNotifications(session.user.id).catch(() => {});
      } catch (e) {
        router.replace('/auth');
      }
    };

    init();
  }, [navState?.key]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!navState?.key) return;

        if (event === 'SIGNED_OUT' || !session) {
          router.replace('/auth');
          return;
        }

        if (event === 'SIGNED_IN') {
          const key = getOnboardingKey(session.user.id);
          const onboarded = await AsyncStorage.getItem(key);

          if (onboarded !== 'true') {
            router.replace('/onboarding');
          } else {
            router.replace('/');
          }

          registerForPushNotifications().catch(() => {});
          markYesterdayTasksMissed(session.user.id).catch(() => {});
          schedulePersonalisedNotifications(session.user.id).catch(() => {});
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navState?.key]);

  return (
    <ToastProvider isDark={isDark}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="add-task" />
        <Stack.Screen name="edit-task" />
        <Stack.Screen name="task-detail" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="intro" />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </ToastProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ProfileProvider>
          <AppWithToast />
        </ProfileProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}