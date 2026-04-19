import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { ProgressDots } from './index';

const NYLA = require('../../assets/icons/nyla-avatar.png');

const TONES = [
  { key: 'soft_coach', label: 'Soft Coach', desc: 'Encourage me gently. I respond to positivity.' },
  { key: 'strict_mentor', label: 'Strict Mentor', desc: "Be direct. Don't let me off the hook." },
  { key: 'savage', label: 'Savage Mode', desc: 'Call me out. I need brutal honesty.' },
  { key: 'comedic', label: 'Comedic', desc: 'Make me laugh but keep me accountable.' },
  { key: 'silent', label: 'Silent', desc: "Just track. I don't need the pep talks." },
];

export default function ToneScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const s = makeStyles(theme);
  const [selected, setSelected] = useState('soft_coach');

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={5} theme={theme} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        <Text style={s.title}>How honest should I be{'\n'}me to be with you?</Text>

        <View style={s.options}>
          {TONES.map((tone) => {
            const active = selected === tone.key;
            return (
              <TouchableOpacity
                key={tone.key}
                style={[
                  s.option,
                  active
                    ? { borderColor: theme.primary, backgroundColor: theme.primaryMuted }
                    : { borderColor: theme.cardBorder, backgroundColor: theme.cardBg },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelected(tone.key)}
              >
                <Text style={[s.toneName, active && { color: theme.primary }]}>{tone.label}</Text>
                <Text style={s.toneDesc}>{tone.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: '/onboarding/color',
              params: { ...params, tone: selected },
            })
          }
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
    scrollContent: { alignItems: 'center', paddingBottom: 20 },
    nyla: { width: 90, height: 90, marginBottom: 24, backgroundColor: 'transparent' },
    title: {
      fontSize: 24, fontWeight: '800', color: t.textPrimary,
      textAlign: 'center', marginBottom: 24,
    },
    options: { width: '100%', gap: 12 },
    option: {
      width: '100%', padding: 18, borderRadius: 16, borderWidth: 2,
    },
    toneName: { fontSize: 16, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
    toneDesc: { fontSize: 13, color: t.textSecondary, lineHeight: 18 },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
