import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';

const NYLA = require('../../assets/icons/nyla-avatar.png');
const BG = require('../../assets/images/onboarding-bg-1.jpg'); // Screen 1 background
const { width, height } = Dimensions.get('window');
const TOTAL_STEPS = 7;

export function ProgressDots({ current, theme }: { current: number; theme: any }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            pd.dot,
            { backgroundColor: i === current ? '#fff' : 'rgba(255,255,255,0.3)' },
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

export { TOTAL_STEPS };

export default function MeetNylaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      {/* Background */}
      <Image source={BG} style={s.bg} resizeMode="cover" />
      {/* Dark overlay for text readability */}
      <View style={s.overlay} />

      <View style={[s.container, { paddingTop: insets.top + 20 }]}>
        <ProgressDots current={0} theme={theme} />

        <View style={s.centerContent}>
          <Image source={NYLA} style={s.nylaLarge} resizeMode="contain" />
          <Text style={s.title}>Hey, I'm Nyla 🔮 your personal accountability coach.</Text>
          <Text style={s.body}>
            I'm not here to just help you plan.{'\n'}I'm here to help you follow through.
          </Text>
          <Text style={s.bodySecondary}>
            I'll track what you actually do — not what you intend to do. No sugarcoating.
          </Text>
        </View>

        <View style={{ paddingBottom: insets.bottom + 20 }}>
          <TouchableOpacity
            style={s.btn}
            activeOpacity={0.8}
            onPress={() => router.push('/onboarding/name')}
          >
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const BRAND = '#7072DD';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A12' },
  bg: { position: 'absolute', top: 0, left: 0, width, height },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,8,20,0.45)',
  },
  container: { flex: 1, paddingHorizontal: 24 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  nylaLarge: {
    width: 140, height: 140, marginBottom: 32, backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center',
    lineHeight: 24, marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bodySecondary: {
    fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center',
    lineHeight: 22, paddingHorizontal: 10,
  },
  btn: {
    height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND,
    shadowColor: BRAND, shadowOpacity: 0.5, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});