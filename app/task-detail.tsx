import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getTaskAnalytics, getTaskDetail, getProfile } from '../lib/tasks';
import { useTheme } from '../lib/ThemeContext';
import { TAG_COLORS, TAG_ICONS, TaskTag } from '../lib/types';
import ShareModal from '../components/sharing/ShareModal';
import { ShareData } from '../components/sharing/types';
import TaskStreakRow from '../components/TaskStreakRow';
import TimeOfDayCard from '../components/TimeOfDayCard';

const SHARE_ICON = require('../assets/icons/share-icon.png');

type FilterGranularity = 7 | 14 | 30;

const FILTER_OPTIONS: { key: FilterGranularity; label: string }[] = [
  { key: 7, label: '7D' },
  { key: 14, label: '14D' },
  { key: 30, label: '30D' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  mon_wed_fri: 'Mon, Wed, Fri',
  tue_thu: 'Tue, Thu',
};

function formatRecurrence(rule: string | null, customDays?: string[] | null): string {
  if (!rule) return 'One-time';
  if (rule === 'custom' && customDays?.length) {
    return customDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
  }
  return RECURRENCE_LABELS[rule] || rule.charAt(0).toUpperCase() + rule.slice(1).replace(/_/g, ', ');
}

function capitalizeBlock(block: string): string {
  return block.charAt(0).toUpperCase() + block.slice(1);
}

const BAR_COUNT = 12;
const CHART_HEIGHT = 120;
const Y_LABELS = ['0%', '25%', '50%', '75%', '100%'];

export default function TaskDetailScreen() {
  const { theme } = useTheme();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [task, setTask] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [filter, setFilter] = useState<FilterGranularity>(30);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [shareVisible, setShareVisible] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !taskId) return;
      const [taskData, analyticsData, profile] = await Promise.all([
        getTaskDetail(taskId),
        getTaskAnalytics(taskId, user.id, filter),
        getProfile(user.id),
      ]);
      setTask(taskData);
      setAnalytics(analyticsData);
      if (profile?.display_name) setDisplayName(profile.display_name);
    } catch (error: any) {
      console.error('Error loading task detail:', error.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!analytics?.periodData) return;
    barAnims.forEach((a) => a.setValue(0));
    const anims = analytics.periodData.map((d: any, i: number) =>
      Animated.spring(barAnims[i], {
        toValue: d.rate / 100,
        damping: 14,
        stiffness: 90,
        useNativeDriver: false,
        delay: i * 30,
      })
    );
    Animated.stagger(30, anims).start();
  }, [analytics?.periodData]);

  if (loading || !task || !analytics) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  const tag = task.tags?.[0] as TaskTag | undefined;
  const tagColor = tag ? TAG_COLORS[tag] : theme.primary;
  const tagIcon = tag ? TAG_ICONS[tag] : '🎯';
  const avgRate = analytics.periodData.length > 0
    ? Math.round(analytics.periodData.reduce((sum: number, d: any) => sum + d.rate, 0) / analytics.periodData.length)
    : 0;

  const completionRate = analytics.total > 0 ? Math.round((analytics.completed / analytics.total) * 100) : 0;
  const getHealthLabel = () => {
    if (completionRate >= 80) return { label: 'Healthy', color: theme.success };
    if (completionRate >= 50) return { label: 'At Risk', color: theme.warning };
    return { label: 'Critical', color: theme.error };
  };
  const health = getHealthLabel();

  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {task?.task_type === 'challenge' && (
          <TouchableOpacity
            hitSlop={10}
            style={{ marginRight: 12 }}
            onPress={() => {
              const days = Math.max(1, Math.ceil((Date.now() - new Date(task.created_at).getTime()) / 86400000));
              const progress = task.current_progress || 0;
              const target = task.target_amount || 1;
              const remaining = Math.max(0, target - progress);
              const deadlineDate = task.deadline ? new Date(task.deadline) : null;
              const daysLeft = deadlineDate ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)) : 0;
              const dailyTarget = daysLeft > 0 ? remaining / daysLeft : remaining;
              const taskTag = task.tags?.[0] || null;
              const taskTagIcon = taskTag ? (TAG_ICONS as any)[taskTag] || null : null;
              const deadlineStr = deadlineDate
                ? deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
              setShareData({
                type: 'challenge',
                challengeName: task.title,
                targetAmount: target,
                targetUnit: task.target_unit || 'units',
                currentProgress: progress,
                durationDays: days,
                dailyAverage: parseFloat((progress / days).toFixed(1)),
                daysLeft,
                dailyTarget: parseFloat(dailyTarget.toFixed(1)),
                remaining,
                deadline: deadlineStr,
                tag: taskTag,
                tagIcon: taskTagIcon,
              });
              setShareVisible(true);
            }}
          >
            <Image source={SHARE_ICON} style={{ width: 22, height: 22, tintColor: theme.textSecondary }} />
          </TouchableOpacity>
        )}
        <TouchableOpacity hitSlop={10}>
          <Ionicons name="trash-outline" size={20} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Task Title Section */}
      <View style={s.titleSection}>
        <Text style={s.taskTitle}>{task.title}</Text>
        <View style={s.tagRow}>
          <Text style={{ fontSize: 16 }}>{tagIcon}</Text>
          <Text style={[s.tagName, { color: tagColor }]}>{tag || 'Untagged'}</Text>
        </View>
        <Text style={s.recurrenceText}>
          {formatRecurrence(task.recurrence_rule, task.custom_days)} · {capitalizeBlock(task.time_block || 'morning')}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Filter Pills */}
        <View style={s.filterRow}>
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[s.filterPill, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setFilter(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterPillText, active && { color: '#FFFFFF' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Momentum Trend */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Momentum Trend</Text>
            <Text style={[s.avgLabel, { color: theme.primary }]}>AVG {avgRate}%</Text>
          </View>
          {analytics.periodData.length > 0 ? (
            <View style={s.chartWrapper}>
              {/* Y-axis labels + grid */}
              <View style={s.yAxis}>
                {Y_LABELS.slice().reverse().map((label) => (
                  <Text key={label} style={s.yLabel}>{label}</Text>
                ))}
              </View>
              <View style={s.chartArea}>
                {/* Grid lines */}
                <View style={s.gridArea}>
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <View
                      key={pct}
                      style={[s.gridLine, { bottom: `${pct}%` }]}
                    />
                  ))}
                  {/* Bars */}
                  <View style={s.barsRow}>
                    {analytics.periodData.map((d: any, i: number) => (
                      <View key={i} style={s.barCol}>
                        <View style={s.barTrack}>
                          <Animated.View
                            style={[
                              s.barFill,
                              {
                                backgroundColor: d.rate > 0 ? theme.primary : theme.momentumBarEmpty,
                                height: barAnims[i]
                                  ? barAnims[i].interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ['4%', '100%'],
                                    })
                                  : '4%',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                {/* X-axis labels */}
                <View style={s.xLabelsRow}>
                  {analytics.periodData.map((d: any, i: number) => (
                    <View key={i} style={s.xLabelCol}>
                      <Text style={s.barLabel}>{i % 2 === 0 || analytics.periodData.length <= 6 ? d.label : ''}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <Text style={s.noDataText}>No data yet for this period</Text>
          )}
        </View>

        {/* Task Streak */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Task Streak</Text>
            <Text style={[s.streakValue, { color: theme.primary }]}>
              🔥 {analytics.streak}
            </Text>
          </View>
          <TaskStreakRow
            dailyData={analytics.dailyData}
            streak={analytics.streak}
            theme={theme}
          />
        </View>

        {/* Time of Day */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Time of Day</Text>
            <View style={[s.healthBadge, { backgroundColor: health.color + '20' }]}>
              <Text style={[s.healthBadgeText, { color: health.color }]}>{health.label}</Text>
            </View>
          </View>
          <TimeOfDayCard
            stats={analytics.timeOfDayStats}
            healthLabel={health.label}
            healthColor={health.color}
            theme={theme}
          />
        </View>

        {/* Bottom Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: theme.success }]}>{analytics.completed}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: theme.error }]}>{analytics.missed}</Text>
            <Text style={s.statLabel}>Missed</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: theme.primary }]}>{analytics.pending}</Text>
            <Text style={s.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {shareData && (
        <ShareModal
          visible={shareVisible}
          onClose={() => { setShareVisible(false); setShareData(null); }}
          data={shareData}
          displayName={displayName}
        />
      )}
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '600',
  },
  recurrenceText: {
    fontSize: 13,
    color: t.textTertiary,
    marginTop: 2,
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textSecondary,
  },

  card: {
    marginHorizontal: 20,
    backgroundColor: t.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  avgLabel: { fontSize: 13, fontWeight: '800' },
  streakValue: { fontSize: 15, fontWeight: '700' },

  chartWrapper: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 28,
  },
  yAxis: {
    width: 32,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
  },
  yLabel: {
    fontSize: 9,
    color: t.textTertiary,
    fontWeight: '600',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
  },
  gridArea: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: t.cardBorder,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT,
    paddingHorizontal: 2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 16,
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    minHeight: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  xLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  xLabelCol: {
    flex: 1,
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 8,
    color: t.textTertiary,
    fontWeight: '600',
  },
  noDataText: {
    color: t.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },

  healthBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  healthBadgeText: { fontSize: 12, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: t.cardBg,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
});
