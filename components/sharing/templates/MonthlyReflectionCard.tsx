import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  month: string;
  completionRate: number;
  streak: number;
  totalTasks: number;
  nylaSummary: string;
  topTag: string;
  topTagIcon: string;
  accentColor?: string;
}

export default function MonthlyReflectionCard({ month, completionRate, streak, totalTasks, nylaSummary, topTag, topTagIcon, accentColor = '#7C5CFC' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: accentColor }]}>Monthly Review</Text>
      <Text style={styles.title}>My {month} in Review</Text>

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(completionRate)}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🔥 {streak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
      </View>

      <View style={[styles.summaryBox, { backgroundColor: accentColor + '18' }]}>
        <Text style={styles.summaryText}>"{nylaSummary}"</Text>
        <Text style={[styles.summaryAttr, { color: accentColor }]}>— Nyla</Text>
      </View>

      <View style={styles.topTagRow}>
        <Text style={styles.topTagIcon}>{topTagIcon}</Text>
        <Text style={styles.topTagText}>{topTag}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  divider: { width: 48, height: 2, borderRadius: 1, marginBottom: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 28 },
  stat: { alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8F8F9D', fontSize: 11, marginTop: 2 },
  summaryBox: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    width: '100%',
  },
  summaryText: { color: '#D4D4D8', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  summaryAttr: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  topTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTagIcon: { fontSize: 20 },
  topTagText: { color: '#8F8F9D', fontSize: 13, fontWeight: '500' },
});
