import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  streak: number;
  completionRate: number;
  done: number;
  missed: number;
  bestDay: string;
  weekRange: string;
  displayName: string;
  accentColor?: string;
}

export default function WeeklyStatsCard({ streak, completionRate, done, missed, bestDay, weekRange, displayName, accentColor = '#7C5CFC' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.weekRange}>{weekRange}</Text>
      <Text style={styles.title}>My Week with Displyn</Text>

      <Text style={styles.heroNumber}>{Math.round(completionRate)}%</Text>
      <Text style={styles.heroLabel}>Completion Rate</Text>

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      <View style={styles.statsGrid}>
        <StatItem label="Completed" value={`${done}`} accent="#34D399" />
        <StatItem label="Missed" value={`${missed}`} accent="#F87171" />
        <StatItem label="Streak" value={`🔥 ${streak}`} accent="#FB923C" />
        <StatItem label="Best Day" value={bestDay} accent={accentColor} />
      </View>

      {displayName ? <Text style={styles.nameTag}>— {displayName}</Text> : null}
    </View>
  );
}

function StatItem({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  weekRange: { color: '#8F8F9D', fontSize: 12, marginBottom: 6, letterSpacing: 0.5 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 24 },
  heroNumber: { color: '#FFFFFF', fontSize: 64, fontWeight: '800', lineHeight: 70 },
  heroLabel: { color: '#8F8F9D', fontSize: 14, marginTop: 4, marginBottom: 20 },
  divider: { width: 48, height: 2, borderRadius: 1, marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, width: '100%' },
  statItem: { alignItems: 'center', minWidth: 80 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8F8F9D', fontSize: 11, marginTop: 2 },
  nameTag: { color: '#55555F', fontSize: 12, marginTop: 24, fontStyle: 'italic' },
});
