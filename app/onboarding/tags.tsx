import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { TAG_COLORS, TAG_ICONS, TASK_TAGS, TaskTag } from '../../lib/types';
import { ProgressDots } from './index';

const MAX_TAGS = 3;

export default function TagsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ displayName: string; appMode: string }>();
  const s = makeStyles(theme);
  const [selected, setSelected] = useState<string[]>([]);

  const isFocused = params.appMode === 'focused';

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      setSelected(selected.filter((t) => t !== tag));
    } else if (selected.length < MAX_TAGS) {
      setSelected([...selected, tag]);
    }
  };

  const canContinue = selected.length >= 1;

  return (
    <View style={[s.container, { paddingTop: insets.top + 20 }]}>
      <ProgressDots current={3} theme={theme} />

      <Text style={s.title}>
        {isFocused ? 'What should I focus on?' : "What matters most right now?"}
      </Text>
      <Text style={s.subtitle}>
        {isFocused
          ? "Pick 1–3 areas. I'll only track these — no judgment on anything else."
          : "Pick up to 3 priorities. I'll watch everything but pay extra attention here."}
      </Text>
      <Text style={s.counter}>{selected.length}/{MAX_TAGS} selected</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
      >
        {TASK_TAGS.map((tag) => {
          const active = selected.includes(tag);
          const color = TAG_COLORS[tag as TaskTag];
          const icon = TAG_ICONS[tag as TaskTag];
          return (
            <TouchableOpacity
              key={tag}
              style={[
                s.chip,
                active
                  ? { borderColor: color, backgroundColor: color + '18' }
                  : { borderColor: theme.cardBorder, backgroundColor: theme.cardBg },
              ]}
              activeOpacity={0.7}
              onPress={() => toggle(tag)}
            >
              <Text style={s.chipIcon}>{icon}</Text>
              <Text style={[s.chipText, active && { color, fontWeight: '700' }]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary, opacity: canContinue ? 1 : 0.4 }]}
          activeOpacity={0.8}
          disabled={!canContinue}
          onPress={() =>
            router.push({
              pathname: '/onboarding/struggle',
              params: { ...params, focusTags: JSON.stringify(selected) },
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
    title: {
      fontSize: 24, fontWeight: '800', color: t.textPrimary,
      textAlign: 'center', marginBottom: 10,
    },
    subtitle: {
      fontSize: 14, color: t.textSecondary, textAlign: 'center',
      lineHeight: 20, marginBottom: 8, paddingHorizontal: 10,
    },
    counter: {
      fontSize: 13, fontWeight: '600', color: t.textTertiary,
      textAlign: 'center', marginBottom: 16,
    },
    scroll: { flex: 1 },
    grid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      justifyContent: 'center', paddingBottom: 20,
    },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 12,
      borderRadius: 14, borderWidth: 1.5,
    },
    chipIcon: { fontSize: 18 },
    chipText: { fontSize: 14, fontWeight: '500', color: t.textPrimary },
    btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
