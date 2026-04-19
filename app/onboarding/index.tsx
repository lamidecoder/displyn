import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';

const NYLA = require('../../assets/icons/nyla-avatar.png');
const TOTAL_STEPS = 7;

function ProgressDots({ current, theme }: { current: number; theme: any }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            pd.dot,
            { backgroundColor: i === current ? theme.primary : theme.surfaceBorder },
            i === current && pd.dotActive,
          ]}
        />
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24, borderRadius: 4 },
});

export { ProgressDots, TOTAL_STEPS };

export default function MeetNylaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme);

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={0} theme={theme} />

      <View style={s.centerContent}>
        <Image source={NYLA} style={s.nylaLarge} resizeMode="contain" />
        <Text style={s.title}>Hey, I'm Nyla — your personal accountability coach.</Text>
        <Text style={s.body}>
          I'm not here to just help you plan.{'\n'}I'm here to help you follow through.
        </Text>
        <Text style={s.bodySecondary}>
          I'll track what you actually do â€” not what you intend to do. No sugarcoating.
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push('/onboarding/name')}
        >
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 24 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nylaLarge: { width: 140, height: 140, marginBottom: 32, backgroundColor: 'transparent' },
    title: {
      fontSize: 28, fontWeight: '800', color: t.textPrimary,
      textAlign: 'center', marginBottom: 16,
    },
    body: {
      fontSize: 16, color: t.textSecondary, textAlign: 'center',
      lineHeight: 24, marginBottom: 12,
    },
    bodySecondary: {
      fontSize: 14, color: t.textTertiary, textAlign: 'center',
      lineHeight: 22, paddingHorizontal: 10,
    },
    btn: {
      height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
