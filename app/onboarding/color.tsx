import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { ACCENT_PRESETS, getAccentPreset } from '../../lib/accentColors';
import { ProgressDots } from './index';

export default function ColorScreen() {
  const { theme, accentKey, setAccentColor, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const s = makeStyles(theme);

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={6} theme={theme} />

      <View style={s.centerContent}>
        <Text style={s.title}>One last thing —{'\n'}make Displyn feel like yours.</Text>
        <Text style={s.subtitle}>Pick a color</Text>

        <View style={s.grid}>
          {ACCENT_PRESETS.map((preset) => {
            const isSelected = accentKey === preset.key;
            const circleColor = isDark ? preset.dark.primary : preset.light.primary;
            return (
              <TouchableOpacity
                key={preset.key}
                style={s.circleWrap}
                activeOpacity={0.7}
                onPress={() => setAccentColor(preset.key)}
              >
                <View
                  style={[
                    s.circle,
                    { backgroundColor: circleColor },
                    isSelected && { borderWidth: 3, borderColor: '#FFFFFF' },
                  ]}
                >
                  {isSelected && (
                    <Text style={s.check}>✓</Text>
                  )}
                </View>
                {isSelected && (
                  <View style={[s.glow, { shadowColor: circleColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.colorLabel, { color: theme.primary }]}>
          {getAccentPreset(accentKey).label}
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: '/onboarding/ready',
              params: { ...params, accentColor: accentKey },
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
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: {
      fontSize: 24, fontWeight: '800', color: t.textPrimary,
      textAlign: 'center', marginBottom: 10,
    },
    subtitle: {
      fontSize: 15, color: t.textSecondary, textAlign: 'center', marginBottom: 32,
    },
    grid: {
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
      gap: 16, paddingHorizontal: 10,
    },
    circleWrap: { alignItems: 'center', justifyContent: 'center', width: 56, height: 56 },
    circle: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
    },
    check: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    glow: {
      position: 'absolute', width: 60, height: 60, borderRadius: 30,
      shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    colorLabel: { fontSize: 16, fontWeight: '700', marginTop: 20, textAlign: 'center' },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
