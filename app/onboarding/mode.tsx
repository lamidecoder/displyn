import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { ProgressDots } from './index';

const NYLA = require('../../assets/icons/nyla-avatar.png');
const BG_MODE = require('../../assets/images/onboarding-bg-3.jpg');


const MODES = [
  {
    key: 'focused',
    title: 'Focused Mode',
    subtitle: 'I want to level up in specific areas',
    detail: 'Nyla only tracks and reflects on what you choose',
  },
  {
    key: 'full_life',
    title: 'Full Life Mode',
    subtitle: 'Track everything. Hold me accountable across the board',
    detail: 'Nyla watches all areas and flags what you\'re neglecting',
  },
];

export default function ModeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ displayName: string }>();
  const s = makeStyles(theme);
  const [selected, setSelected] = useState('full_life');

  return (
    <View style={s.root}>
      <Image source={BG_MODE} style={s.bgImg} resizeMode="cover" />
      <View style={s.overlay} />
      <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={2} theme={theme} />

      <View style={s.centerContent}>
        <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        <Text style={s.title}>How much of your life{'\n'}do you want me watching?</Text>

        <View style={s.cards}>
          {MODES.map((m) => {
            const active = selected === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  s.card,
                  active
                    ? { borderColor: theme.primary, backgroundColor: theme.primaryMuted }
                    : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelected(m.key)}
              >
                <Text style={[s.cardTitle, active && { color: theme.primary }]}>{m.title}</Text>
                <Text style={s.cardSubtitle}>{m.subtitle}</Text>
                <Text style={s.cardDetail}>{m.detail}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: '/onboarding/tags',
              params: { ...params, appMode: selected },
            })
          }
        >
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
    </View>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0A0A12' },
    bgImg: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,20,0.5)' },
    container: { flex: 1, paddingHorizontal: 24 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nyla: { width: 90, height: 90, marginBottom: 24, backgroundColor: 'transparent' },
    title: {
      fontSize: 24, fontWeight: '800', color: '#FFFFFF',
      textAlign: 'center', marginBottom: 28,
    },
    cards: { width: '100%', gap: 14 },
    card: {
      width: '100%', padding: 20, borderRadius: 16, borderWidth: 2,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
    cardSubtitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
    cardDetail: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });