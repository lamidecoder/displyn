import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ChallengeItem {
  challengeName: string;
  targetAmount: number;
  targetUnit: string;
  currentProgress: number;
  percentage: number;
}

interface Props {
  challenges: ChallengeItem[];
  accentColor?: string;
}

export default function MultiChallengeCard({ challenges, accentColor = '#7C5CFC' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: accentColor }]}>MY CHALLENGES</Text>
      <Text style={styles.title}>
        {challenges.length} Active Goal{challenges.length !== 1 ? 's' : ''}
      </Text>

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      {challenges.slice(0, 5).map((c, i) => {
        const pct = Math.min(c.percentage, 100);
        const isComplete = pct >= 100;
        return (
          <View key={i} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.challengeName} numberOfLines={1}>{c.challengeName}</Text>
              <Text style={[styles.pctText, isComplete && { color: '#34D399' }]}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accentColor }, isComplete && { backgroundColor: '#34D399' }]} />
            </View>
            <Text style={styles.progressLabel}>
              {c.currentProgress}/{c.targetAmount} {c.targetUnit}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  divider: { width: 40, height: 2, borderRadius: 1, marginBottom: 20 },
  row: { marginBottom: 18 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  challengeName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  pctText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: '#1E1E26', borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { color: '#8F8F9D', fontSize: 11, marginTop: 4 },
});
