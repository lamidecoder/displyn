import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';

export default function StatsScreen() {
  const { theme } = useTheme();
  const [weeklyRate, setWeeklyRate] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalMissed, setTotalMissed] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const { data: weekInstances } = await supabase
        .from('task_instances')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_date', weekAgoStr);

      if (weekInstances && weekInstances.length > 0) {
        const completed = weekInstances.filter((i) => i.status === 'completed').length;
        const missed = weekInstances.filter((i) => i.status === 'missed').length;
        setTotalCompleted(completed);
        setTotalMissed(missed);
        setWeeklyRate(Math.round((completed / weekInstances.length) * 100));
      }

      const { data: allInstances } = await supabase
        .from('task_instances')
        .select('scheduled_date, status')
        .eq('user_id', user.id)
        .order('scheduled_date', { ascending: false });

      if (allInstances) {
        let currentStreak = 0;
        const dateMap = new Map<string, { total: number; completed: number }>();

        allInstances.forEach((i) => {
          const existing = dateMap.get(i.scheduled_date) || { total: 0, completed: 0 };
          existing.total++;
          if (i.status === 'completed') existing.completed++;
          dateMap.set(i.scheduled_date, existing);
        });

        const sortedDates = Array.from(dateMap.keys()).sort().reverse();
        for (const date of sortedDates) {
          const day = dateMap.get(date)!;
          if (day.total > 0 && (day.completed / day.total) >= 0.8) {
            currentStreak++;
          } else {
            break;
          }
        }
        setStreak(currentStreak);
      }
    } catch (error: any) {
      console.error('Error loading stats:', error.message);
    }
  };

  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Stats</Text>
      </View>

      <ScrollView style={s.scroll}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{weeklyRate}%</Text>
          <Text style={s.statLabel}>Weekly Completion Rate</Text>
        </View>

        <View style={s.row}>
          <View style={[s.statCard, s.halfCard]}>
            <Text style={[s.statValue, { color: theme.success }]}>{totalCompleted}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
          <View style={[s.statCard, s.halfCard]}>
            <Text style={[s.statValue, { color: theme.error }]}>{totalMissed}</Text>
            <Text style={s.statLabel}>Missed</Text>
          </View>
        </View>

        <View style={s.statCard}>
          <Text style={s.statValue}>🔥 {streak}</Text>
          <Text style={s.statLabel}>Day Streak (80%+ completion)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: t.textPrimary },
  scroll: { flex: 1, paddingHorizontal: 20 },
  statCard: {
    backgroundColor: t.cardBg,
    borderRadius: 12,
    padding: 24,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  halfCard: { flex: 1 },
  row: { flexDirection: 'row', gap: 14 },
  statValue: { fontSize: 36, fontWeight: '800', color: t.textPrimary, marginBottom: 8 },
  statLabel: { fontSize: 14, color: t.textSecondary },
});