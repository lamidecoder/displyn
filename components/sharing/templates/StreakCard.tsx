import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  streak: number;
  completionRate: number;
  totalDone: number;
  accentColor?: string;
}

export default function StreakCard({ streak, completionRate, totalDone, accentColor = '#7C5CFC' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.fireEmoji}>{'🔥'}</Text>
      <Text style={styles.heroNumber}>{streak}</Text>
      <Text style={styles.heroLabel}>Day Streak</Text>

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      <Text style={styles.tagline}>Consistency is identity</Text>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(completionRate)}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalDone}</Text>
          <Text style={styles.statLabel}>Tasks Done</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fireEmoji: { fontSize: 48, marginBottom: 8 },
  heroNumber: { color: '#FFFFFF', fontSize: 80, fontWeight: '800', lineHeight: 88 },
  heroLabel: { color: '#FB923C', fontSize: 18, fontWeight: '600', marginTop: 2, letterSpacing: 1 },
  divider: { width: 48, height: 2, borderRadius: 1, marginVertical: 24 },
  tagline: { color: '#8F8F9D', fontSize: 14, fontStyle: 'italic', marginBottom: 28, letterSpacing: 0.5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stat: { alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8F8F9D', fontSize: 11, marginTop: 2 },
  statDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#55555F' },
});
