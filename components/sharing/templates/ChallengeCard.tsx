import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TAG_THEME } from '../../../lib/theme';

interface Props {
  challengeName: string;
  targetAmount: number;
  targetUnit: string;
  currentProgress: number;
  durationDays: number;
  dailyAverage: number;
  daysLeft: number;
  dailyTarget: number;
  remaining: number;
  deadline: string | null;
  tag: string | null;
  tagIcon: string | null;
  accentColor?: string;
}

export default function ChallengeCard({
  challengeName, targetAmount, targetUnit, currentProgress,
  durationDays, dailyAverage, daysLeft, dailyTarget, remaining,
  deadline, tag, tagIcon, accentColor = '#7C5CFC',
}: Props) {
  const pct = Math.min(100, Math.round((currentProgress / targetAmount) * 100));
  const isComplete = pct >= 100;
  const tagMeta = tag ? (TAG_THEME as any)[tag] : null;
  const tagColor = tagMeta?.color || accentColor;

  return (
    <View style={styles.container}>
      <Text style={[styles.badge, !isComplete && { color: accentColor }]}>
        {isComplete ? 'Challenge Complete \u2713' : 'Challenge in Progress'}
      </Text>
      <Text style={styles.title}>{challengeName}</Text>

      {tag && (
        <View style={[styles.tagPill, { backgroundColor: tagColor + '25' }]}>
          {tagIcon ? <Text style={styles.tagIconTxt}>{tagIcon}</Text> : null}
          <Text style={[styles.tagText, { color: tagColor }]}>{tag}</Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      <Text style={styles.heroNumber}>{pct}%</Text>
      <Text style={styles.progressText}>
        {currentProgress}/{targetAmount} {targetUnit}
      </Text>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accentColor }, isComplete && { backgroundColor: '#34D399' }]} />
      </View>

      {deadline && (
        <View style={styles.timelineRow}>
          <Text style={styles.timelineLabel}>Start</Text>
          <View style={styles.timelineLine} />
          <Text style={styles.timelineLabel}>{deadline}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{durationDays}</Text>
          <Text style={styles.statLabel}>Days In</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{daysLeft}</Text>
          <Text style={styles.statLabel}>Days Left</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{dailyTarget.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{targetUnit}/day</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{remaining}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{dailyAverage.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{targetUnit}/day avg</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badge: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 26,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  tagIconTxt: { fontSize: 13, marginRight: 5 },
  tagText: { fontSize: 11, fontWeight: '600' },
  divider: { width: 40, height: 2, borderRadius: 1, marginBottom: 18 },
  heroNumber: { color: '#FFFFFF', fontSize: 48, fontWeight: '800', lineHeight: 54 },
  progressText: { color: '#8F8F9D', fontSize: 13, marginTop: 2, marginBottom: 12 },
  progressBar: { width: '80%', height: 5, backgroundColor: '#1E1E26', borderRadius: 3, marginBottom: 16 },
  progressFill: { height: 5, borderRadius: 3 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginBottom: 18,
    gap: 8,
  },
  timelineLine: { flex: 1, height: 1, backgroundColor: '#55555F' },
  timelineLabel: { color: '#8F8F9D', fontSize: 10, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 12,
  },
  stat: { alignItems: 'center', minWidth: 60 },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#8F8F9D', fontSize: 10, marginTop: 2 },
});
