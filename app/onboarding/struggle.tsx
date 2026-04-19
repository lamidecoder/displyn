import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { ProgressDots } from './index';

const NYLA = require('../../assets/icons/nyla-avatar.png');

const STRUGGLES = [
  { key: 'lose_momentum', label: 'I start strong but lose momentum after a few days' },
  { key: 'overplan', label: 'I plan too much and do too little' },
  { key: 'forget', label: 'I forget about tasks once the day gets busy' },
  { key: 'avoid_hard', label: 'I avoid the hard tasks and do the easy ones' },
  { key: 'inconsistent', label: "I'm inconsistent — some weeks are great, others are empty" },
];

export default function StruggleScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const s = makeStyles(theme);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={4} theme={theme} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        <Text style={s.title}>Be honest — what usually{'\n'}gets in the way?</Text>

        <View style={s.options}>
          {STRUGGLES.map((item) => {
            const active = selected === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  s.option,
                  active
                    ? { borderColor: theme.primary, backgroundColor: theme.primaryMuted }
                    : { borderColor: theme.cardBorder, backgroundColor: theme.cardBg },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelected(item.key)}
              >
                <Text style={[s.optionText, active && { color: theme.primary, fontWeight: '700' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary, opacity: selected ? 1 : 0.4 }]}
          activeOpacity={0.8}
          disabled={!selected}
          onPress={() =>
            router.push({
              pathname: '/onboarding/tone',
              params: { ...params, struggleType: selected! },
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
    optionText: { fontSize: 15, fontWeight: '500', color: t.textPrimary, lineHeight: 22 },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
