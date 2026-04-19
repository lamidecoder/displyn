import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DayData {
  date: string;
  day: string;
  isScheduled: boolean;
  status: string;
}

interface Props {
  dailyData: DayData[];
  streak: number;
  theme: any;
}

export default function TaskStreakRow({ dailyData, streak, theme }: Props) {
  const scheduled = dailyData.filter((d) => d.isScheduled);

  const getStreakMessage = (s: number) => {
    if (s >= 14) return 'Incredible! You are unstoppable!';
    if (s >= 7) return 'Amazing streak! Keep going everyday champ';
    if (s >= 3) return 'Nice momentum! Stay consistent';
    if (s >= 1) return 'Good start! Keep it up';
    const hasMissed = scheduled.some((d) => d.status === 'missed');
    if (hasMissed) return "Don't give up — start fresh!";
    return 'Start your streak today!';
  };

  return (
    <View>
      <View style={styles.row}>
        {scheduled.map((d, i) => {
          const isCompleted = d.status === 'completed';
          const isMissed = d.status === 'missed';
          const isPending = d.status === 'pending';

          let bg = 'transparent';
          let borderColor = theme.cardBorder;
          let borderWidth = 2;
          if (isCompleted) { bg = theme.primary; borderColor = theme.primary; }
          else if (isMissed) { bg = theme.error; borderColor = theme.error; }
          else if (isPending) { bg = 'transparent'; borderColor = theme.primary; }

          return (
            <View key={i} style={styles.col}>
              <View style={[styles.circle, { backgroundColor: bg, borderColor, borderWidth }]}>
                {isCompleted && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                {isMissed && <Ionicons name="close" size={18} color="#FFFFFF" />}
              </View>
              <Text style={[styles.dayLabel, { color: theme.textTertiary },
                isPending && { color: theme.primary, fontWeight: '700' },
              ]}>
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.message, { color: theme.textSecondary }]}>
        {getStreakMessage(streak)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 14,
  },
  col: {
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
