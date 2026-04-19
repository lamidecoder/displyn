import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';

const NYLA = require('../../assets/icons/nyla-avatar.png');

export default function ReadyScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme);
  const [saving, setSaving] = useState(false);

  const params = useLocalSearchParams<{
    displayName: string;
    appMode: string;
    focusTags: string;
    struggleType: string;
    tone: string;
    accentColor: string;
  }>();

  const displayName = params.displayName || 'there';

  const handleStart = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth'); return; }

      let focusTags: string[] = [];
      try { focusTags = JSON.parse(params.focusTags || '[]'); } catch {}

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: params.displayName?.trim() || null,
        app_mode: params.appMode || 'full_life',
        focus_tags: focusTags,
        struggle_type: params.struggleType || null,
        notification_tone: params.tone || 'soft_coach',
        accent_color: params.accentColor || 'purple',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarding_completed: true,
      });

      await AsyncStorage.setItem('notification_tone', params.tone || 'soft_coach');
      await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');

      router.replace('/');
    } catch (e) {
      console.error('Onboarding save error:', e);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      } catch {}
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <View style={s.centerContent}>
        <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        <Text style={s.title}>Alright, {displayName}.</Text>
        <Text style={s.subtitle}>
          Add your first task. I will handle the rest.
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
          disabled={saving}
          onPress={handleStart}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.btnText}>Start</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 24 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nyla: { width: 140, height: 140, marginBottom: 32, backgroundColor: 'transparent' },
    title: {
      fontSize: 28, fontWeight: '800', color: t.textPrimary,
      textAlign: 'center', marginBottom: 12,
    },
    subtitle: {
      fontSize: 16, color: t.textSecondary, textAlign: 'center',
      lineHeight: 24, paddingHorizontal: 20,
    },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });