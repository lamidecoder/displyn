import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GestureHandlerRootView, PanGestureHandler, RectButton, State } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import {
    createTask,
    deleteTask,
    getChallengeTasksWithStats,
    getProfile,
    getRecurringTasksWithStats,
    getTaskInstancesByRange,
    getWeeklyInstancesForTask,
    skipTaskInstance,
    applyLocalCompletions,
    saveLocalCompletion,
} from '../../lib/tasks';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../components/Toast';
import ConfirmSheet from '../../components/ConfirmSheet';
import { useProfile } from '../../lib/ProfileContext';
import { buildTemplatePrefill, getRecommendedTemplates, logTemplateUsage, TaskTemplate, TemplateTaskType } from '../../lib/templates';
import { TAG_COLORS, TAG_ICONS, TASK_TAGS, TaskTag } from '../../lib/types';
import ShareModal from '../../components/sharing/ShareModal';
import { ShareData } from '../../components/sharing/types';

type TypeFilter = 'one_time' | 'recurring' | 'challenge';
type StatusFilter = 'all' | 'pending' | 'completed' | 'missed';
type DayFilter = 7 | 14 | 30 | 'custom';

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'one_time', label: 'One time' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'challenge', label: 'Challenge' },
];

const DAY_OPTIONS: { key: DayFilter; label: string }[] = [
  { key: 7, label: '7 Days' },
  { key: 14, label: '14 Days' },
  { key: 30, label: '30 Days' },
];

const HEADER_ICONS = {
  calendar: require('../../assets/icons/header-calendar.png'),
  aiGen: require('../../assets/icons/header-ai-gen.png'),
};
const SHARE_ICON = require('../../assets/icons/share-icon.png');
const TAG_SHORT_LABELS: Record<TaskTag, string> = {
  'Work & Career': 'Work',
  'Health & Fitness': 'Health',
  'Learning & Skill Building': 'Learning',
  'Finance & Money': 'Finance',
  'Personal Growth': 'Growth',
  'Relationships & Social': 'Social',
  'Admin & Life Maintenance': 'Admin',
  'Self-Care': 'Selfcare',
  'Creative & Expression': 'Creative',
  'Spiritual / Purpose': 'Spiritual',
  'Lifestyle & Leisure': 'Lifestyle',
};

// ========== Swipe Action Buttons ==========
function SwipeActions({
  taskId,
  taskTitle,
  createdAt,
  theme,
  onDelete,
  swipeRef,
}: {
  taskId: string;
  taskTitle: string;
  createdAt?: string | null;
  theme: any;
  onDelete: (id: string, title: string, createdAt?: string | null) => void;
  swipeRef: React.RefObject<Swipeable | null>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <RectButton
        style={{ backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', width: 70 }}
        onPress={() => {
          swipeRef.current?.close();
          router.push({ pathname: '/edit-task', params: { taskId } });
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Edit</Text>
      </RectButton>
      <RectButton
        style={{ backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 70 }}
        onPress={() => {
          swipeRef.current?.close();
          onDelete(taskId, taskTitle, createdAt);
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Delete</Text>
      </RectButton>
    </View>
  );
}

// ========== Challenge Task Swipe Card ==========
function ChallengeSwipeCard({
  task, theme, s, onDelete, onShare,
}: {
  task: any; theme: any; s: any;
  onDelete: (id: string, title: string, createdAt?: string | null) => void;
  onShare: (task: any) => void;
}) {
  const swipeRef = useRef<Swipeable | null>(null);
  const tag = task.tags?.[0] as TaskTag | undefined;
  const tagColor = tag ? TAG_COLORS[tag] : theme.primary;
  const tagIcon = tag ? TAG_ICONS[tag] : '🎯';
  const cs = task.challengeStats;
  const isComplete = cs && cs.percentage >= 100;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <SwipeActions taskId={task.id} taskTitle={task.title} createdAt={task.created_at} theme={theme} onDelete={onDelete} swipeRef={swipeRef} />
      )}
      overshootRight={false}
    >
      <View style={[s.challengeCard, isComplete && { borderColor: theme.success + '60' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={[s.challengeIcon, { backgroundColor: tagColor + '20' }]}>
            <Text style={{ fontSize: 18 }}>{tagIcon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.challengeTitle}>{task.title}</Text>
            <Text style={s.challengeMeta}>
              <Text style={{ color: tagColor }}>{tag || 'Untagged'}</Text>
              {task.deadline && ` · Due ${task.deadline}`}
            </Text>
          </View>
          <TouchableOpacity hitSlop={10} onPress={() => onShare(task)} style={{ padding: 4, marginLeft: 8 }}>
            <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: theme.textSecondary }} />
          </TouchableOpacity>
          {isComplete && (
            <View style={[s.challengeCompleteBadge, { backgroundColor: theme.success + '20', marginLeft: 6 }]}>
              <Text style={{ fontSize: 12, color: theme.success, fontWeight: '700' }}>Complete</Text>
            </View>
          )}
        </View>
        {cs && (
          <>
            <View style={s.challengeProgressTrack}>
              <View style={[s.challengeProgressFill, {
                width: `${Math.min(cs.percentage, 100)}%`,
                backgroundColor: isComplete ? theme.success : theme.primary,
              }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={s.challengeStatText}>
                {cs.currentProgress}/{cs.targetAmount} {cs.targetUnit}
              </Text>
              <Text style={[s.challengeStatText, { fontWeight: '700', color: theme.textPrimary }]}>
                {cs.percentage}%
              </Text>
            </View>
            <View style={s.challengeStatsRow}>
              <View style={s.challengeStatBox}>
                <Text style={s.challengeStatValue}>{cs.dailyTarget}</Text>
                <Text style={s.challengeStatLabel}>{cs.targetUnit}/day</Text>
              </View>
              <View style={s.challengeStatBox}>
                <Text style={s.challengeStatValue}>{cs.daysLeft}</Text>
                <Text style={s.challengeStatLabel}>days left</Text>
              </View>
              <View style={s.challengeStatBox}>
                <Text style={s.challengeStatValue}>{cs.remaining}</Text>
                <Text style={s.challengeStatLabel}>remaining</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Swipeable>
  );
}

// ========== One-Time Task Swipe Card ==========
function OneTimeSwipeCard({
  inst, tag, tagColor, stats, isDone, isMissed, theme, s, onDelete, onSkip,
}: {
  inst: any; tag: TaskTag | undefined; tagColor: string;
  stats: { completed: number; total: number }; isDone: boolean; isMissed: boolean;
  theme: any; s: any;
  onDelete: (id: string, title: string, createdAt?: string | null) => void;
  onSkip: (instanceId: string) => void;
}) {
  const toast = useToast();
  const swipeRef = useRef<Swipeable | null>(null);

  // Format the scheduled date — show "Today" if it's today
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = inst.scheduled_date === todayStr;
  const dateLabel = isToday
    ? 'Today'
    : new Date(inst.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  // Overdue escalation for one-time tasks
  const overdueDays = inst.overdue_days || 0;
  const overdueColor = overdueDays >= 3 ? '#EF4444' : overdueDays === 2 ? '#F97316' : overdueDays === 1 ? '#EAB308' : null;
  const overdueLabel = overdueDays >= 3
    ? `This task is ${overdueDays} days overdue. Critically overdue tasks are prioritised and affect your insights.`
    : overdueDays === 2
    ? 'This task is 2 days overdue. It will escalate to critical tomorrow if not completed.'
    : overdueDays === 1
    ? 'This task is 1 day overdue. Complete it soon to maintain your streak.'
    : '';

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <SwipeActions taskId={inst.task_id} taskTitle={inst.task?.title || 'Task'} createdAt={inst.task?.created_at} theme={theme} onDelete={onDelete} swipeRef={swipeRef} />
      )}
      overshootRight={false}
    >
      <View
        style={[
          s.taskCard,
          isDone && { opacity: 0.7 },
          isMissed && { opacity: 0.7 },
          overdueColor && !isDone && { borderLeftWidth: 4, borderLeftColor: overdueColor },
        ]}
      >
        <View style={[s.tagDot, { backgroundColor: tagColor }]} />
        <View style={s.taskInfo}>
          <Text style={[s.taskTitle, isDone && s.taskTitleDone]}>{inst.task?.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.taskMeta}>
              <Text style={{ color: tagColor }}>{tag || 'Untagged'}</Text>
            </Text>
            {inst.task?.deadline && (
              <Text style={s.deadlineLabel}>
                Due {new Date(inst.task.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
          </View>
        </View>
        <View style={s.taskRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[s.taskDate, isToday && { color: theme.primary, fontWeight: '700' }]}>{dateLabel}</Text>
            {overdueColor && !isDone && !isMissed && (
              <TouchableOpacity onPress={() => toast.warning('Overdue', overdueLabel)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 14, color: overdueColor, fontWeight: '700' }}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {inst.status === 'pending' && (
              <TouchableOpacity
                style={s.skipBtnSmall}
                onPress={() => onSkip(inst.id)}
              >
                <Text style={s.skipBtnSmallText}>✕</Text>
              </TouchableOpacity>
            )}
            {isDone && <Text style={[s.statusLabel, { color: theme.textSecondary }]}>Done</Text>}
            {isMissed && <Text style={[s.statusLabel, { color: theme.error, opacity: 0.8 }]}>Missed</Text>}
            {inst.status === 'pending' && <Text style={[s.statusLabel, { color: theme.primary }]}>Pending</Text>}
            {inst.status === 'snoozed' && <Text style={[s.statusLabel, { color: theme.warning }]}>Snoozed</Text>}
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

// ========== Recurring Task Card with Expandable Instances ==========
function RecurringTaskCard({
  task,
  theme,
  s,
  onDelete,
  onTap,
}: {
  task: any;
  theme: any;
  s: any;
  onDelete: (id: string, title: string, createdAt?: string | null) => void;
  onTap: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const swipeRef = useRef<Swipeable | null>(null);

  const tag = task.tags?.[0] as TaskTag | undefined;
  const tagColor = tag ? TAG_COLORS[tag] : theme.primary;
  const recurrenceLabel = task.recurrence_rule
    ? task.recurrence_rule.charAt(0).toUpperCase() + task.recurrence_rule.slice(1).replace('_', '/')
    : 'Custom';

  // Weekly streak data (7 days, Sun–Sat, recurrence-aware)
  const weeklyStreak: { date: string; day: string; isScheduled: boolean; status: string }[] =
    task.weeklyStreak || [];

  const toggleExpand = async () => {
    if (!expanded && upcoming.length === 0) {
      setLoadingUpcoming(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const data = await getWeeklyInstancesForTask(task.id, user.id);
          setUpcoming(data || []);
        }
      } catch (e) {
        console.error('Error loading weekly instances:', e);
      } finally {
        setLoadingUpcoming(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <SwipeActions taskId={task.id} taskTitle={task.title} createdAt={task.created_at} theme={theme} onDelete={onDelete} swipeRef={swipeRef} />
      )}
      overshootRight={false}
    >
    <View style={s.recurringCard}>
      {/* Main card content — tappable to go to detail */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onTap(task.id)}
      >
        <View style={s.recurringCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.recurringTitle}>{task.title}</Text>
            <View style={s.recurringMetaRow}>
              {/* Weekly streak bars — recurrence-aware */}
              <View style={s.miniStreak}>
                {weeklyStreak.map((day, i) => {
                  let barColor = theme.momentumBarEmpty;
                  if (!day.isScheduled) {
                    barColor = theme.momentumBarEmpty + '40'; // very dim for non-scheduled days
                  } else if (day.status === 'completed') {
                    barColor = theme.primary;
                  } else if (day.status === 'missed') {
                    barColor = theme.error;
                  } else if (day.status === 'pending') {
                    barColor = theme.warning + '80';
                  } else if (day.status === 'upcoming') {
                    barColor = theme.primaryMuted;
                  }
                  return (
                    <View key={i} style={[s.miniStreakBar, { backgroundColor: barColor }]} />
                  );
                })}
              </View>
              <Text style={s.recurringMeta}>
                {recurrenceLabel} · {task.stats?.upcoming || 0} upcoming · {task.stats?.completed || 0} completed
              </Text>
            </View>
          </View>
          <View style={s.recurringTagBadge}>
            <Text style={[s.recurringTagText, { color: tagColor }]}>{tag || 'Untagged'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable upcoming instances */}
      <TouchableOpacity style={s.expandBtn} onPress={toggleExpand}>
        <Text style={s.expandBtnText}>
          {expanded ? 'Hide weekly instances' : 'Show weekly instances'}
        </Text>
        <Text style={s.expandArrow}>{expanded ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={s.upcomingList}>
          {loadingUpcoming && (
            <Text style={s.upcomingLoading}>Loading...</Text>
          )}
          {!loadingUpcoming && upcoming.length === 0 && (
            <Text style={s.upcomingLoading}>No scheduled instances this week</Text>
          )}
          {upcoming.map((inst) => {
            const date = new Date(inst.scheduled_date);
            const dayLabel = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const isDone = inst.status === 'completed';
            const isMissed = inst.status === 'missed';
            const isPast = isDone || isMissed;
            const isToday = inst.scheduled_date === new Date().toISOString().split('T')[0];

            // Dot styling based on status
            let dotBorderColor = theme.surfaceBorder;
            let dotBgColor = 'transparent';
            if (isDone) {
              dotBorderColor = theme.success;
              dotBgColor = theme.success;
            } else if (isMissed) {
              dotBorderColor = theme.error;
              dotBgColor = 'transparent';
            } else if (isToday) {
              dotBorderColor = theme.primary;
            }

            return (
              <View key={inst.id} style={s.upcomingRow}>
                <View style={[s.upcomingDot, {
                  borderColor: dotBorderColor,
                  backgroundColor: dotBgColor,
                }]}>
                  {isDone && <Text style={{ fontSize: 10, color: '#fff', fontWeight: '800' }}>✓</Text>}
                  {isMissed && <Text style={{ fontSize: 9, color: theme.error, fontWeight: '800' }}>✕</Text>}
                </View>
                <View style={[s.upcomingTagDot, { backgroundColor: tagColor }]} />
                <Text style={[
                  s.upcomingTitle,
                  isDone && { textDecorationLine: 'line-through', color: theme.textTertiary },
                  isMissed && { color: theme.textTertiary },
                  isToday && { color: theme.primary, fontWeight: '700' },
                ]}>{task.title}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[
                    s.upcomingDate,
                    isToday && { color: theme.primary, fontWeight: '600' },
                  ]}>{isToday ? 'Today' : dayLabel}</Text>
                  {isDone && <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: '600' }}>Done</Text>}
                  {isMissed && <Text style={{ fontSize: 10, color: theme.error, fontWeight: '600', opacity: 0.8 }}>Missed</Text>}
                  {inst.status === 'upcoming' && <Text style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '500' }}>Upcoming</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
    </Swipeable>
  );
}

// ========== Inline Calendar Grid ==========
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function CalendarGrid({
  selectedDate,
  onSelectDate,
  theme,
}: {
  selectedDate: string | null; // 'YYYY-MM-DD' or null
  onSelectDate: (dateStr: string) => void;
  theme: any;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const todayStr = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else { setViewMonth(viewMonth - 1); }
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else { setViewMonth(viewMonth + 1); }
  };

  // Build the grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  // getDay() returns 0=Sun, we want Mon=0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      {/* Month/Year header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={prevMonth}>
            <Text style={{ fontSize: 18, color: theme.textSecondary }}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth}>
            <Text style={{ fontSize: 18, color: theme.textSecondary }}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row' }}>
        {DAY_HEADERS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textTertiary }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (day === null) {
              return <View key={col} style={{ flex: 1, height: 36 }} />;
            }
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;

            return (
              <TouchableOpacity
                key={col}
                style={{
                  flex: 1,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => onSelectDate(dateStr)}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? theme.primary : 'transparent',
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: theme.primary,
                }}>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? '700' : '400',
                    color: isSelected ? '#fff' : isToday ? theme.primary : theme.textPrimary,
                  }}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ========== Main Tasks Screen ==========
export default function TasksScreen() {
  const { theme, isDark } = useTheme();
  const toast = useToast();
  const [confirmSheet, setConfirmSheet] = React.useState<{
    visible: boolean; title: string; message: string;
    confirmLabel: string; destructive: boolean; icon: string; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', confirmLabel: 'Confirm', destructive: false, icon: 'alert-circle', onConfirm: () => {} });
  const showConfirm = (cfg: Omit<typeof confirmSheet, 'visible'>) => setConfirmSheet({ ...cfg, visible: true });
  const hideConfirm = () => setConfirmSheet(prev => ({ ...prev, visible: false }));

  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const [instances, setInstances] = useState<any[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<any[]>([]);
  const [challengeTasks, setChallengeTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('one_time');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dayFilter, setDayFilter] = useState<DayFilter>(30);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [pendingCustomDate, setPendingCustomDate] = useState<string | null>(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerTaskType, setComposerTaskType] = useState<TemplateTaskType>('one_time');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateItems, setTemplateItems] = useState<TaskTemplate[]>([]);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [isCustomDraft, setIsCustomDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftTimeBlock, setDraftTimeBlock] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [draftRecurrenceRule, setDraftRecurrenceRule] = useState('daily');
  const [draftCustomDays, setDraftCustomDays] = useState<string[]>([]);
  const [draftDate, setDraftDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [draftDeadline, setDraftDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [draftTargetAmount, setDraftTargetAmount] = useState('');
  const [draftTargetUnit, setDraftTargetUnit] = useState('');
  const [showDraftDatePicker, setShowDraftDatePicker] = useState(false);
  const [showDraftDeadlinePicker, setShowDraftDeadlinePicker] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const [skipInstanceId, setSkipInstanceId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [skipNote, setSkipNote] = useState('');
  const [skipAction, setSkipAction] = useState<'missed' | 'rescheduled'>('missed');
  const [skipDate, setSkipDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [skipSaving, setSkipSaving] = useState(false);
  const [showSkipDatePicker, setShowSkipDatePicker] = useState(false);
  const [pickerTop, setPickerTop] = useState<number>(120);
  const scheduledDateBtnRef = useRef<View | null>(null);
  const deadlineDateBtnRef = useRef<View | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fetchDays = dayFilter === 'custom' ? 90 : dayFilter;
      const [instanceData, recurringData, challengeData, profile] = await Promise.all([
        getTaskInstancesByRange(user.id, fetchDays, true),
        getRecurringTasksWithStats(user.id),
        getChallengeTasksWithStats(user.id),
        getProfile(user.id),
      ]);
      const withLocal = await applyLocalCompletions(instanceData || []);
      setInstances(withLocal);
      setRecurringTasks(recurringData || []);
      setChallengeTasks(challengeData || []);
      setDisplayName(profile?.display_name || '');
    } catch (error: any) {
      console.error('Error loading tasks:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dayFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadComposerTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const focusTags = (profile?.focus_tags || []) as string[];
      const items = await getRecommendedTemplates(focusTags, composerTaskType);
      setTemplateItems(items);
    } catch {
      setTemplateItems([]);
    } finally {
      setTemplateLoading(false);
    }
  }, [composerTaskType, profile?.focus_tags]);

  useEffect(() => {
    if (composerExpanded) loadComposerTemplates();
  }, [composerExpanded, loadComposerTemplates]);

  useEffect(() => {
    resetTemplateDraft();
  }, [composerTaskType]);

  const handleCreateFromTemplate = (tpl: TaskTemplate) => {
    setCreatingTemplateId(tpl.id);
    setIsCustomDraft(false);
    const prefill = buildTemplatePrefill(tpl);
    setSelectedTemplate(tpl);
    setDraftTitle(prefill.title || tpl.name);
    setDraftTags(prefill.tags?.length ? prefill.tags : [tpl.tag]);
    setDraftTimeBlock((prefill.time_block as any) || 'morning');
    setDraftRecurrenceRule(prefill.recurrence_rule || 'daily');
    setDraftCustomDays(prefill.custom_days || []);
    const todayStr = new Date().toISOString().split('T')[0];
    setDraftDate(prefill.deadline || todayStr);
    setDraftDeadline(prefill.deadline || todayStr);
    setDraftTargetAmount(
      typeof prefill.target_amount === 'number' && prefill.target_amount > 0
        ? String(prefill.target_amount)
        : ''
    );
    setDraftTargetUnit(prefill.target_unit || '');
    setTimeout(() => setCreatingTemplateId(null), 120);
  };

  const resetTemplateDraft = () => {
    setSelectedTemplate(null);
    setIsCustomDraft(false);
    setDraftTitle('');
    setDraftTags([]);
    setDraftTimeBlock('morning');
    setDraftRecurrenceRule('daily');
    setDraftCustomDays([]);
    setDraftTargetAmount('');
    setDraftTargetUnit('');
    setShowDraftDatePicker(false);
    setShowDraftDeadlinePicker(false);
  };

  const beginCustomTaskDraft = () => {
    const initialTag =
      templateCategory !== 'all' && TASK_TAGS.includes(templateCategory as TaskTag)
        ? (templateCategory as TaskTag)
        : TASK_TAGS[0];
    setSelectedTemplate(null);
    setIsCustomDraft(true);
    setDraftTitle('');
    setDraftTags([initialTag]);
    setDraftTimeBlock('morning');
    setDraftRecurrenceRule('daily');
    setDraftCustomDays([]);
    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDraftDate(todayStr);
    setDraftDeadline(d.toISOString().split('T')[0]);
    setDraftTargetAmount('');
    setDraftTargetUnit('');
  };

  const openAnchoredPicker = (type: 'date' | 'deadline') => {
    const cardHeight = 390;
    const screenHeight = Dimensions.get('window').height;
    const maxTop = screenHeight - cardHeight - 20;
    const fallbackTop = Math.max(100, Math.min(screenHeight * 0.28, maxTop));
    const ref = type === 'date' ? scheduledDateBtnRef : deadlineDateBtnRef;

    const open = () => {
      if (type === 'date') setShowDraftDatePicker(true);
      else setShowDraftDeadlinePicker(true);
    };

    if (!ref.current || typeof (ref.current as any).measureInWindow !== 'function') {
      setPickerTop(fallbackTop);
      open();
      return;
    }

    (ref.current as any).measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const desiredTop = y + h + 8;
      setPickerTop(Math.max(80, Math.min(desiredTop, maxTop)));
      open();
    });
  };

  const handleFinalizeTemplateCreate = async () => {
    if (!selectedTemplate && !isCustomDraft) return;
    const draftTaskType = selectedTemplate?.task_type || composerTaskType;
    if (!draftTitle.trim()) {
      toast.warning('Missing field', 'Please provide a task title.');
      return;
    }
    if (!draftTags.length) {
      toast.warning('Missing field', 'Please select at least one tag.');
      return;
    }
    if (draftTaskType === 'challenge') {
      if (!draftTargetAmount || isNaN(Number(draftTargetAmount)) || Number(draftTargetAmount) <= 0) {
        toast.warning('Missing field', 'Please enter a valid challenge target amount.');
        return;
      }
      if (!draftTargetUnit.trim()) {
        toast.warning('Missing field', 'Please enter a challenge unit (e.g. pages, km).');
        return;
      }
      if (!draftDeadline) {
        toast.warning('Missing field', 'Please set a challenge deadline.');
        return;
      }
    }
    if (draftTaskType === 'one_time' && !draftDate) {
      toast.warning('Missing field', 'Please choose when to perform this task.');
      return;
    }
    if (draftTaskType === 'recurring' && draftRecurrenceRule === 'custom' && draftCustomDays.length === 0) {
      toast.warning('Missing field', 'Select at least one custom day.');
      return;
    }

    try {
      setCreatingTemplateId(selectedTemplate?.id || 'custom');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      await createTask({
        user_id: user.id,
        title: draftTitle.trim(),
        notes: null,
        task_type: draftTaskType,
        recurrence_rule: draftTaskType === 'recurring' ? draftRecurrenceRule : null,
        custom_days:
          draftTaskType === 'recurring' && draftRecurrenceRule === 'custom'
            ? draftCustomDays
            : null,
        time_block: draftTimeBlock,
        deadline:
          draftTaskType === 'one_time'
            ? draftDate
            : draftTaskType === 'challenge'
              ? draftDeadline
              : null,
        tags: draftTags,
        is_active: true,
        target_amount: draftTaskType === 'challenge' ? Number(draftTargetAmount) : null,
        target_unit: draftTaskType === 'challenge' ? draftTargetUnit.trim() : null,
      });

      if (selectedTemplate?.id) {
        await logTemplateUsage(selectedTemplate.id, user.id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setComposerExpanded(false);
      setTemplateSearch('');
      setTemplateCategory('all');
      setTypeFilter(draftTaskType);
      setStatusFilter('all');
      resetTemplateDraft();
      await loadData();
    } catch (e: any) {
      toast.error('Something went wrong', 'Could not create task from template');
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const handleDelete = (taskId: string, title: string, createdAt?: string | null) => {
    const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const withinGrace = (now - createdTime) < oneHourMs;

    if (withinGrace) {
      showConfirm({
        title: 'Delete Task',
        message: `Delete "${title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
        icon: 'trash-outline',
        onConfirm: async () => { hideConfirm(); try { await deleteTask(taskId); loadData(); } catch (e: any) {
      if (e.message && (e.message.includes('service_role_key') || e.message.includes('unrecognized configuration'))) return;
      toast.error('Something went wrong', e.message);
    } },
      });
    } else {
      showConfirm({
        title: 'Impact Warning',
        message: `"${title}" was logged over an hour ago. Deleting it will affect your behavioural insights.`,
        confirmLabel: 'Delete Anyway',
        destructive: true,
        icon: 'warning-outline',
        onConfirm: async () => { hideConfirm(); try { await deleteTask(taskId); loadData(); } catch (e: any) {
      if (e.message && (e.message.includes('service_role_key') || e.message.includes('unrecognized configuration'))) return;
      toast.error('Something went wrong', e.message);
    } },
      });
    }
  };

  const handleSkipTask = async (instanceId: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSkipInstanceId(instanceId);
    setSkipReason('');
    setSkipNote('');
    setSkipAction('missed');
    setSkipDate(d.toISOString().split('T')[0]);
    setShowSkipDatePicker(false);
    setSkipVisible(true);
  };

  const submitSkip = async () => {
    if (!skipInstanceId) return;
    if (!skipReason.trim()) {
      toast.warning('Reason required', 'Please tell Nyla why you are skipping this task.'); return;
      return;
    }
    try {
      setSkipSaving(true);
      await skipTaskInstance(skipInstanceId, {
        reason: skipReason.trim(),
        note: skipNote.trim() || null,
        rescheduledTo: skipAction === 'rescheduled' ? skipDate : null,
      });
      setSkipVisible(false);
      setSkipInstanceId(null);
      await loadData();
    } catch (e: any) {
      if (e.message && (e.message.includes('service_role_key') || e.message.includes('unrecognized configuration'))) return;
      toast.error('Something went wrong', e.message);
    } finally {
      setSkipSaving(false);
    }
  };

  // ===== Instance-based filtering with smart direction =====
  const todayStr = new Date().toISOString().split('T')[0];
  const typeFiltered = instances.filter((i) => {
    if (i.task?.task_type !== typeFilter) return false;
    if (dayFilter === 'custom' && customDate) {
      if (i.scheduled_date === customDate) return true;
      // Also include tasks completed on the selected date (e.g. overdue tasks done that day)
      if (i.completed_at && i.completed_at.split('T')[0] === customDate) return true;
      return false;
    }
    return true;
  });

  // Apply direction-aware date filtering based on status tab
  const directionFiltered = typeFiltered.filter((i) => {
    const date = i.scheduled_date;
    if (statusFilter === 'pending') return date >= todayStr; // future only
    if (statusFilter === 'completed' || statusFilter === 'missed') return date <= todayStr; // past only
    return true; // 'all' — both directions
  });

  const pendingCount = typeFiltered.filter((i) => i.status === 'pending' && i.scheduled_date >= todayStr).length;
  const doneCount = typeFiltered.filter((i) => i.status === 'completed' && i.scheduled_date <= todayStr).length;
  const missedCount = typeFiltered.filter((i) => i.status === 'missed' && i.scheduled_date <= todayStr).length;
  const filteredInstances = statusFilter === 'all'
    ? directionFiltered
    : directionFiltered.filter((i) => i.status === statusFilter);

  const taskCompletionMap = new Map<string, { completed: number; total: number }>();
  instances.forEach((inst) => {
    const tid = inst.task_id;
    const existing = taskCompletionMap.get(tid) || { completed: 0, total: 0 };
    existing.total++;
    if (inst.status === 'completed') existing.completed++;
    taskCompletionMap.set(tid, existing);
  });

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: typeFiltered.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'completed', label: 'Done', count: doneCount },
    { key: 'missed', label: 'Missed', count: missedCount },
  ];

  const isRecurringTab = typeFilter === 'recurring';
  const isChallengeTab = typeFilter === 'challenge';
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  const TYPE_ORDER: TypeFilter[] = ['one_time', 'recurring', 'challenge'];
  const handleTypeSwipe = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const { translationX, velocityX } = nativeEvent;
      if (Math.abs(translationX) > 40 || Math.abs(velocityX) > 300) {
        const idx = TYPE_ORDER.indexOf(typeFilter);
        if (translationX < 0 && idx < TYPE_ORDER.length - 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setTypeFilter(TYPE_ORDER[idx + 1]);
          setStatusFilter('all');
        } else if (translationX > 0 && idx > 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setTypeFilter(TYPE_ORDER[idx - 1]);
          setStatusFilter('all');
        }
      }
    }
  };

  const s = makeStyles(theme);
  const filteredTemplates = templateItems.filter((t) => {
    const categoryMatch = templateCategory === 'all' || t.tag === templateCategory;
    const q = templateSearch.trim().toLowerCase();
    const searchMatch = !q
      || t.name.toLowerCase().includes(q)
      || (t.description || '').toLowerCase().includes(q)
      || (t.tag || '').toLowerCase().includes(q);
    return categoryMatch && searchMatch;
  });
  const categoryOptions = [
    'all',
    ...TASK_TAGS.filter((tag) => templateItems.some((t) => t.tag === tag)),
  ];
  const customDayOptions = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const draftTaskType = selectedTemplate?.task_type || composerTaskType;
  const dockBottom = insets.bottom + 46;
  const collapsedDockHeight = 76;
  const pickerWidth = Math.min(Dimensions.get('window').width - 28, 360);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Tasks</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => setShowDayPicker(true)}
          >
            <Image source={HEADER_ICONS.calendar} style={s.headerIconImg} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => router.push('/(tabs)?tab=ai')}
          >
            <Image source={HEADER_ICONS.aiGen} style={s.headerIconImg} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar Filter Overlay */}
      <Modal
        visible={showDayPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <Pressable style={s.overlayBackdrop} onPress={() => setShowDayPicker(false)}>
          <Pressable style={s.overlayCard} onPress={() => {}}>
            {/* Quick filter options */}
            <View style={s.quickFilterRow}>
              {DAY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    s.quickFilterPill,
                    dayFilter === opt.key && s.quickFilterPillActive,
                  ]}
                  onPress={() => {
                    setDayFilter(opt.key);
                    setCustomDate(null);
                    setPendingCustomDate(null);
                    setShowDayPicker(false);
                  }}
                >
                  <Text style={[
                    s.quickFilterText,
                    dayFilter === opt.key && s.quickFilterTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

            {/* Divider */}
            <View style={s.overlayDivider} />

            {/* Calendar */}
            <CalendarGrid
              selectedDate={pendingCustomDate ?? customDate}
              onSelectDate={(dateStr) => setPendingCustomDate(dateStr)}
              theme={theme}
            />

            {/* Footer buttons */}
            <View style={s.overlayFooter}>
              <TouchableOpacity
                onPress={() => {
                  setPendingCustomDate(null);
                  setCustomDate(null);
                  setDayFilter(30);
                  setShowDayPicker(false);
                }}
              >
                <Text style={s.overlayResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.overlayDoneBtn}
                onPress={() => {
                  if (pendingCustomDate) {
                    setCustomDate(pendingCustomDate);
                    setDayFilter('custom');
                  }
                  setPendingCustomDate(null);
                  setShowDayPicker(false);
                }}
              >
                <Text style={s.overlayDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Type Filter Tabs — underline style */}
      <View style={s.typeTabs}>
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={s.typeTab}
            onPress={() => { setTypeFilter(tab.key); setStatusFilter('all'); }}
          >
            <Text style={[s.typeTabText, typeFilter === tab.key && s.typeTabTextActive]}>
              {tab.label}
            </Text>
            {typeFilter === tab.key && <View style={s.typeTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Filter Tabs — underline style with counts */}
      {!isRecurringTab && !isChallengeTab && (
        <View style={s.statusTabs}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={s.statusTab}
              onPress={() => setStatusFilter(tab.key)}
            >
              <View style={s.statusTabInner}>
                <Text style={[s.statusTabText, statusFilter === tab.key && s.statusTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[s.statusBadge, statusFilter === tab.key && s.statusBadgeActive]}>
                  <Text style={[s.statusBadgeText, statusFilter === tab.key && s.statusBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              </View>
              {statusFilter === tab.key && <View style={s.statusTabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

      {/* Active date filter indicator */}
      {dayFilter === 'custom' && customDate && (
        <View style={s.activeFilterRow}>
          <View style={s.activeFilterChip}>
            <Ionicons name="calendar" size={14} color={theme.primary} />
            <Text style={s.activeFilterText}>
              {new Date(customDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => { setCustomDate(null); setDayFilter(30); }}
            >
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task List */}
      <PanGestureHandler
        onHandlerStateChange={handleTypeSwipe}
        activeOffsetX={[-20, 20]}
        enabled={!composerExpanded}
      >
      <ScrollView
        style={s.scroll}
        scrollEnabled={!composerExpanded}
        contentContainerStyle={{ paddingBottom: dockBottom + collapsedDockHeight + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={theme.primary}
          />
        }
      >
        {/* ===== RECURRING VIEW ===== */}
        {isRecurringTab && (
          <>
            {recurringTasks.length === 0 && !loading && (
              <View style={s.emptyState}>
                <Image
                  source={require('../../assets/icons/empty-state-mascot.png')}
                  style={s.emptyMascot}
                  resizeMode="contain"
                />
                <Text style={s.emptyTitle}>No tasks yet</Text>
                <Text style={s.emptySubtitle}>
                  Create a recurring task to build your habits
                </Text>
              </View>
            )}
            {recurringTasks.map((task) => (
              <RecurringTaskCard
                key={task.id}
                task={task}
                theme={theme}
                s={s}
                onDelete={handleDelete}
                onTap={(taskId) => router.push({ pathname: '/task-detail', params: { taskId } })}
              />
            ))}
          </>
        )}

        {/* ===== ONE-TIME VIEW ===== */}
        {typeFilter === 'one_time' && (
          <>
            {filteredInstances.length === 0 && !loading && (
              <View style={s.emptyState}>
                <Image
                  source={statusFilter === 'missed'
                    ? require('../../assets/icons/empty-state-happy.png')
                    : require('../../assets/icons/empty-state-mascot.png')}
                  style={s.emptyMascot}
                  resizeMode="contain"
                />
                <Text style={s.emptyTitle}>
                  {statusFilter === 'missed' ? 'No missed tasks' : 'No tasks yet'}
                </Text>
                <Text style={s.emptySubtitle}>
                  {statusFilter === 'missed'
                    ? 'You are crushing it!'
                    : 'Create your first task to get started'}
                </Text>
              </View>
            )}

            {filteredInstances.map((inst) => {
              const tag = inst.task?.tags?.[0] as TaskTag | undefined;
              const tagColor = tag ? TAG_COLORS[tag] : theme.primary;
              const stats = taskCompletionMap.get(inst.task_id) || { completed: 0, total: 0 };
              const isDone = inst.status === 'completed';
              const isMissed = inst.status === 'missed';

              return (
                <OneTimeSwipeCard
                  key={inst.id}
                  inst={inst}
                  tag={tag}
                  tagColor={tagColor}
                  stats={stats}
                  isDone={isDone}
                  isMissed={isMissed}
                  theme={theme}
                  s={s}
                  onDelete={handleDelete}
                  onSkip={handleSkipTask}
                />
              );
            })}
          </>
        )}

        {/* ===== CHALLENGE VIEW ===== */}
        {isChallengeTab && (
          <>
            {challengeTasks.length === 0 && !loading && (
              <View style={s.emptyState}>
                <Image
                  source={require('../../assets/icons/empty-state-mascot.png')}
                  style={s.emptyMascot}
                  resizeMode="contain"
                />
                <Text style={s.emptyTitle}>No goals yet</Text>
                <Text style={s.emptySubtitle}>
                  Set a challenge to push yourself further
                  </Text>
                </View>
            )}
            {challengeTasks.map((task) => (
              <ChallengeSwipeCard
                key={task.id}
                task={task}
                theme={theme}
                s={s}
                onDelete={handleDelete}
                onShare={(t: any) => {
                  const cs = t.challengeStats;
                  const target = t.target_amount || cs?.targetAmount || 1;
                  const progress = t.current_progress || cs?.currentProgress || 0;
                  const remaining = Math.max(0, target - progress);
                  const deadlineDate = t.deadline ? new Date(t.deadline) : null;
                  const daysLeft = deadlineDate ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)) : 0;
                  const dailyTarget = daysLeft > 0 ? remaining / daysLeft : remaining;
                  const days = Math.max(1, Math.ceil((Date.now() - new Date(t.created_at).getTime()) / 86400000));
                  const taskTag = t.tags?.[0] || null;
                  const taskTagIcon = taskTag ? (TAG_ICONS as any)[taskTag] || null : null;
                  const deadlineStr = deadlineDate
                    ? deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;
                  setShareData({
                    type: 'challenge',
                    challengeName: t.title,
                    targetAmount: target,
                    targetUnit: t.target_unit || cs?.targetUnit || 'units',
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
              />
            ))}
            {challengeTasks.length > 0 && (
              <TouchableOpacity
                style={s.shareAllBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setShareData({
                    type: 'multi_challenge',
                    challenges: challengeTasks.map((t: any) => ({
                      challengeName: t.title,
                      targetAmount: t.target_amount || t.challengeStats?.targetAmount || 0,
                      targetUnit: t.target_unit || t.challengeStats?.targetUnit || 'units',
                      currentProgress: t.current_progress || t.challengeStats?.currentProgress || 0,
                      percentage: t.challengeStats?.percentage || 0,
                    })),
                  });
                  setShareVisible(true);
                }}
              >
                <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: '#FFFFFF' }} />
                <Text style={s.shareAllBtnText}>
                  Share {challengeTasks.length === 1 ? 'Challenge' : 'All Challenges'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

      </ScrollView>
      </PanGestureHandler>

      {composerExpanded && (
        <Pressable style={s.templateBackdrop} onPress={() => { setComposerExpanded(false); resetTemplateDraft(); }} />
      )}

      {/* Bottom expandable template creator */}
      <View style={[s.templateDockWrap, { bottom: dockBottom }, composerExpanded && s.templateDockWrapExpanded]}>
        <TouchableOpacity
          style={[s.templateDockHandle, { backgroundColor: theme.primary }]}
          activeOpacity={0.85}
          onPress={() => {
            if (composerExpanded) resetTemplateDraft();
            setComposerExpanded((v) => !v);
          }}
        >
          <View style={s.templateDockHandleRow}>
            <Text style={s.templateDockTitle}>Create Task</Text>
            <Ionicons
              name={composerExpanded ? 'chevron-down' : 'chevron-up'}
              size={18}
              color="#FFFFFF"
            />
          </View>
          {!composerExpanded && (
            <Text style={s.templateDockSub}>Tap to expand templates</Text>
          )}
        </TouchableOpacity>

        {composerExpanded && (
          <View style={s.templatePanel}>
            <View style={s.templateTypeRow}>
              {([
                { key: 'one_time', label: 'One-time' },
                { key: 'recurring', label: 'Recurring' },
                { key: 'challenge', label: 'Challenge' },
              ] as const).map((item) => {
                const active = composerTaskType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.templateTypePill, active && s.templateTypePillActive]}
                    onPress={() => {
                      setComposerTaskType(item.key);
                      setTemplateCategory('all');
                      setTemplateSearch('');
                      resetTemplateDraft();
                    }}
                  >
                    <Text style={[s.templateTypeText, active && s.templateTypeTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!selectedTemplate && !isCustomDraft ? (
              <>
                <TextInput
                  style={s.templateSearch}
                  placeholder="Search templates"
                  placeholderTextColor={theme.textTertiary}
                  value={templateSearch}
                  onChangeText={setTemplateSearch}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.templateCategoryRow}
                  style={{ maxHeight: 42 }}
                >
                  {categoryOptions.map((cat) => {
                    const active = templateCategory === cat;
                    const label =
                      cat === 'all'
                        ? 'All'
                        : TAG_SHORT_LABELS[cat as TaskTag] || String(cat);
                    return (
                      <TouchableOpacity
                        key={String(cat)}
                        style={[s.templateCategoryChip, active && s.templateCategoryChipActive]}
                        onPress={() => setTemplateCategory(String(cat))}
                      >
                        <Text style={[s.templateCategoryText, active && s.templateCategoryTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {templateLoading ? (
                  <View style={s.templateLoadingWrap}>
                    <ActivityIndicator color={theme.primary} />
                    <Text style={s.templateHint}>Loading templates...</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={s.templateList}>
                    {filteredTemplates.map((tpl) => (
                      <TouchableOpacity
                        key={tpl.id}
                        style={s.templateItem}
                        disabled={creatingTemplateId === tpl.id}
                        onPress={() => handleCreateFromTemplate(tpl)}
                      >
                        <View style={s.templateItemLeft}>
                          <Text style={s.templateItemIcon}>{tpl.icon || '✨'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.templateItemTitle}>{tpl.name}</Text>
                            {!!tpl.description && (
                              <Text style={s.templateItemDesc}>{tpl.description}</Text>
                            )}
                          </View>
                        </View>
                        {creatingTemplateId === tpl.id ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                        )}
                      </TouchableOpacity>
                    ))}
                    {!filteredTemplates.length && (
                      <Text style={[s.templateHint, { textAlign: 'center', marginTop: 16 }]}>
                        No templates found
                      </Text>
                    )}
                    <View style={{ height: 8 }} />
                  </ScrollView>
                )}
              </>
            ) : (
              <ScrollView style={s.templateList} showsVerticalScrollIndicator={false}>
                <View style={s.reviewHeader}>
                  <Text style={s.reviewHeaderTitle}>Review before creating</Text>
                  <TouchableOpacity onPress={resetTemplateDraft}>
                    <Text style={[s.reviewChangeTemplate, { color: theme.primary }]}>
                      {isCustomDraft ? 'Back to templates' : 'Change template'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={s.templateSearch}
                  placeholder="Task title"
                  placeholderTextColor={theme.textTertiary}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                />

                <View style={s.reviewRow}>
                  <Text style={s.reviewLabel}>Category</Text>
                  <View style={s.reviewPills}>
                    {TASK_TAGS.map((tag) => {
                      const active = draftTags[0] === tag;
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[s.reviewPill, active && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` }]}
                          onPress={() => setDraftTags([tag])}
                        >
                          <Text style={[s.reviewPillText, active && { color: theme.primary }]}>
                            {TAG_SHORT_LABELS[tag]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={s.reviewRow}>
                  <Text style={s.reviewLabel}>Time</Text>
                  <View style={s.reviewPills}>
                    {(['morning', 'afternoon', 'evening'] as const).map((block) => {
                      const active = draftTimeBlock === block;
                      return (
                        <TouchableOpacity
                          key={block}
                          style={[s.reviewPill, active && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` }]}
                          onPress={() => setDraftTimeBlock(block)}
                        >
                          <Text style={[s.reviewPillText, active && { color: theme.primary }]}>
                            {block.charAt(0).toUpperCase() + block.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {draftTaskType === 'one_time' && (
                  <TouchableOpacity
                    ref={(r) => { scheduledDateBtnRef.current = r as any; }}
                    style={s.reviewDateBtn}
                    onPress={() => openAnchoredPicker('date')}
                  >
                    <Text style={s.reviewDateLabel}>Scheduled date</Text>
                    <Text style={s.reviewDateValue}>
                      {new Date(draftDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                )}

                {draftTaskType === 'recurring' && (
                  <>
                    <View style={s.reviewRow}>
                      <Text style={s.reviewLabel}>Repeat</Text>
                      <View style={s.reviewPills}>
                        {['daily', 'weekdays', 'mon_wed_fri', 'tue_thu', 'weekends', 'custom'].map((rule) => {
                          const active = draftRecurrenceRule === rule;
                          return (
                            <TouchableOpacity
                              key={rule}
                              style={[s.reviewPill, active && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` }]}
                              onPress={() => setDraftRecurrenceRule(rule)}
                            >
                              <Text style={[s.reviewPillText, active && { color: theme.primary }]}>
                                {rule.replace(/_/g, ' ')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    {draftRecurrenceRule === 'custom' && (
                      <View style={s.reviewPills}>
                        {customDayOptions.map((day) => {
                          const active = draftCustomDays.includes(day);
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[s.reviewPill, active && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` }]}
                              onPress={() =>
                                setDraftCustomDays((prev) =>
                                  prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                                )
                              }
                            >
                              <Text style={[s.reviewPillText, active && { color: theme.primary }]}>{day.toUpperCase()}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                {draftTaskType === 'challenge' && (
                  <>
                    <View style={s.reviewDualRow}>
                      <TextInput
                        style={[s.templateSearch, s.reviewHalfInput]}
                        placeholder="Target amount"
                        keyboardType="numeric"
                        value={draftTargetAmount}
                        onChangeText={setDraftTargetAmount}
                        placeholderTextColor={theme.textTertiary}
                      />
                      <TextInput
                        style={[s.templateSearch, s.reviewHalfInput]}
                        placeholder="Unit (pages, km)"
                        value={draftTargetUnit}
                        onChangeText={setDraftTargetUnit}
                        placeholderTextColor={theme.textTertiary}
                      />
                    </View>
                    <TouchableOpacity
                      ref={(r) => { deadlineDateBtnRef.current = r as any; }}
                      style={s.reviewDateBtn}
                      onPress={() => openAnchoredPicker('deadline')}
                    >
                      <Text style={s.reviewDateLabel}>Deadline</Text>
                      <Text style={s.reviewDateValue}>
                        {new Date(draftDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            )}

            {!selectedTemplate && !isCustomDraft ? (
              <TouchableOpacity
                style={s.templateScratchBtn}
                onPress={beginCustomTaskDraft}
              >
                <Text style={s.templateScratchBtnText}>Create custom task</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.templateScratchBtn, { backgroundColor: theme.primary }]}
                disabled={creatingTemplateId === (selectedTemplate?.id || 'custom')}
                onPress={handleFinalizeTemplateCreate}
              >
                {creatingTemplateId === (selectedTemplate?.id || 'custom') ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[s.templateScratchBtnText, { color: '#FFFFFF' }]}>Create task now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={showDraftDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDraftDatePicker(false); setPickerTop(120); }}
      >
        <Pressable style={s.pickerBackdrop} onPress={() => { setShowDraftDatePicker(false); setPickerTop(120); }} />
        <View style={[s.pickerModalCard, { top: pickerTop, width: pickerWidth }]}>
          <Text style={s.pickerModalTitle}>Select scheduled date</Text>
          <DateTimePicker
            value={new Date(draftDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            style={s.pickerCalendar}
            onChange={(_, selected) => {
              if (selected) setDraftDate(selected.toISOString().split('T')[0]);
              if (Platform.OS !== 'ios') setShowDraftDatePicker(false);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[s.pickerDoneBtn, { backgroundColor: theme.primary }]}
              onPress={() => { setShowDraftDatePicker(false); setPickerTop(120); }}
            >
              <Text style={s.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <Modal
        visible={showDraftDeadlinePicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDraftDeadlinePicker(false); setPickerTop(120); }}
      >
        <Pressable style={s.pickerBackdrop} onPress={() => { setShowDraftDeadlinePicker(false); setPickerTop(120); }} />
        <View style={[s.pickerModalCard, { top: pickerTop, width: pickerWidth }]}>
          <Text style={s.pickerModalTitle}>Select deadline</Text>
          <DateTimePicker
            value={new Date(draftDeadline)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            style={s.pickerCalendar}
            onChange={(_, selected) => {
              if (selected) setDraftDeadline(selected.toISOString().split('T')[0]);
              if (Platform.OS !== 'ios') setShowDraftDeadlinePicker(false);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[s.pickerDoneBtn, { backgroundColor: theme.primary }]}
              onPress={() => { setShowDraftDeadlinePicker(false); setPickerTop(120); }}
            >
              <Text style={s.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <Modal
        visible={skipVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (skipSaving) return;
          setSkipVisible(false);
          setSkipInstanceId(null);
          setShowSkipDatePicker(false);
        }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.skipOverlay}>
            <View style={s.skipCard}>
              <Text style={s.skipTitle}>Skip Task</Text>
              <Text style={s.skipSubtitle}>Why are you skipping this task?</Text>

              <TextInput
                style={s.skipInput}
                placeholder="Type reason..."
                placeholderTextColor={theme.textTertiary}
                value={skipReason}
                onChangeText={setSkipReason}
              />

              <View style={s.skipReasonChips}>
                {[
                  "I'm too tired",
                  "I'm in a rush",
                  'Unexpected schedule',
                  'Not realistic today',
                ].map((r) => (
                  <TouchableOpacity key={r} style={s.skipReasonChip} onPress={() => setSkipReason(r)}>
                    <Text style={s.skipReasonChipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[s.skipInput, { marginTop: 8 }]}
                placeholder="Optional note for Nyla"
                placeholderTextColor={theme.textTertiary}
                value={skipNote}
                onChangeText={setSkipNote}
                multiline
              />

              <View style={s.skipActionRow}>
                <TouchableOpacity
                  style={[s.skipActionBtn, skipAction === 'missed' && { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
                  onPress={() => setSkipAction('missed')}
                >
                  <Text style={[s.skipActionText, skipAction === 'missed' && { color: theme.primary }]}>Mark missed</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.skipActionBtn, skipAction === 'rescheduled' && { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
                  onPress={() => setSkipAction('rescheduled')}
                >
                  <Text style={[s.skipActionText, skipAction === 'rescheduled' && { color: theme.primary }]}>Reschedule</Text>
                </TouchableOpacity>
              </View>

              {skipAction === 'rescheduled' && (
                <>
                  <TouchableOpacity style={s.reviewDateBtn} onPress={() => setShowSkipDatePicker(true)}>
                    <Text style={s.reviewDateLabel}>Reschedule date</Text>
                    <Text style={s.reviewDateValue}>
                      {new Date(skipDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  {showSkipDatePicker && (
                    <DateTimePicker
                      value={new Date(skipDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={new Date()}
                      onChange={(_, selected) => {
                        if (selected) setSkipDate(selected.toISOString().split('T')[0]);
                        if (Platform.OS !== 'ios') setShowSkipDatePicker(false);
                      }}
                    />
                  )}
                </>
              )}

              <View style={s.skipFooter}>
                <TouchableOpacity
                  style={[s.skipFooterBtn, s.skipFooterBtnSecondary]}
                  onPress={() => {
                    if (skipSaving) return;
                    setSkipVisible(false);
                    setSkipInstanceId(null);
                    setShowSkipDatePicker(false);
                  }}
                  disabled={skipSaving}
                >
                  <Text style={[s.skipFooterBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.skipFooterBtn, s.skipFooterBtnPrimary]}
                  onPress={submitSkip}
                  disabled={skipSaving}
                >
                  <Text style={[s.skipFooterBtnText, { color: '#fff' }]}>{skipSaving ? 'Saving...' : 'Save skip'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {shareData && (
        <ShareModal
          visible={shareVisible}
          onClose={() => { setShareVisible(false); setShareData(null); }}
          data={shareData}
          displayName={displayName}
        />
      )}
    </View>
      <ConfirmSheet
        visible={confirmSheet.visible}
        title={confirmSheet.title}
        message={confirmSheet.message}
        confirmLabel={confirmSheet.confirmLabel}
        destructive={confirmSheet.destructive}
        icon={confirmSheet.icon}
        onConfirm={confirmSheet.onConfirm}
        onCancel={hideConfirm}
        isDark={isDark}
      />
    </GestureHandlerRootView>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: t.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImg: { width: 38, height: 38, borderRadius: 19 },
  headerCreateImg: { width: 38, height: 38, borderRadius: 19 },

  // Calendar Filter Overlay
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    width: '88%',
    backgroundColor: t.elevated || t.cardBg,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  quickFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickFilterPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
  },
  quickFilterPillActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
  quickFilterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  overlayDivider: {
    height: 1,
    backgroundColor: t.surfaceBorder,
    marginBottom: 16,
  },
  overlayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.surfaceBorder,
  },
  overlayResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: t.textSecondary,
  },
  overlayDoneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.primary,
  },
  overlayDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Type Tabs — underline style
  typeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.surfaceBorder,
  },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  typeTabText: { fontSize: 14, fontWeight: '600', color: t.textTertiary },
  typeTabTextActive: { color: t.textPrimary, fontWeight: '700' },
  typeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: t.primary,
    borderRadius: 1,
  },

  // Status Tabs — underline style
  statusTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.surfaceBorder,
  },
  statusTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusTabInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusTabText: { fontSize: 12, fontWeight: '600', color: t.textTertiary },
  statusTabTextActive: { color: t.textPrimary, fontWeight: '700' },
  statusTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: t.primary,
    borderRadius: 1,
  },
  activeFilterRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: t.primary + '15',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: t.primary + '30',
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.primary,
  },
  statusBadge: {
    backgroundColor: t.surface,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  statusBadgeActive: { backgroundColor: t.primaryMuted },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: t.textTertiary },
  statusBadgeTextActive: { color: t.primary },

  // Scroll
  scroll: { flex: 1, paddingHorizontal: 20 },

  // ===== Recurring Task Cards =====
  recurringCard: {
    backgroundColor: t.cardBg,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.cardBorder,
    overflow: 'hidden',
  },
  recurringCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  recurringTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
  recurringMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniStreak: { flexDirection: 'row', gap: 2 },
  miniStreakBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: t.momentumBarEmpty,
  },
  recurringMeta: { fontSize: 12, color: t.textSecondary, flex: 1 },
  recurringTagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recurringTagText: { fontSize: 12, fontWeight: '600' },

  // Expand Button
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: t.cardBorder,
  },
  expandBtnText: { fontSize: 13, color: t.textTertiary, fontWeight: '500' },
  expandArrow: { fontSize: 12, color: t.textTertiary },

  // Upcoming Instances
  upcomingList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.cardBorder,
    gap: 10,
  },
  upcomingDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  upcomingTitle: { flex: 1, fontSize: 13, color: t.textPrimary, fontWeight: '500' },
  upcomingDate: { fontSize: 12, color: t.textSecondary },
  upcomingLoading: { fontSize: 13, color: t.textTertiary, paddingVertical: 8 },

  // ===== Instance Cards (One-time / Challenge) =====
  taskCard: {
    backgroundColor: t.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  tagDot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: t.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through', color: t.textTertiary },
  taskMeta: { fontSize: 12, color: t.textSecondary, marginTop: 3 },
  deadlineLabel: { fontSize: 11, fontWeight: '600', color: t.textTertiary, marginTop: 3 },
  taskRight: { alignItems: 'flex-end', gap: 2 },
  taskDate: { fontSize: 11, fontWeight: '500', color: t.textSecondary },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  skipBtnSmall: {
    backgroundColor: t.bg === '#0F0F14' ? '#2D1215' : '#FEE2E2',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnSmallText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },

  // ===== Challenge Cards =====
  challengeCard: {
    backgroundColor: t.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  challengeMeta: { fontSize: 12, color: t.textSecondary, marginTop: 3 },
  challengeCompleteBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  challengeProgressTrack: {
    height: 8,
    backgroundColor: t.momentumBarEmpty,
    borderRadius: 4,
    overflow: 'hidden',
  },
  challengeProgressFill: { height: '100%', borderRadius: 4 },
  challengeStatText: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
  challengeStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  challengeStatBox: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.surfaceBorder,
  },
  challengeStatValue: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  challengeStatLabel: { fontSize: 10, color: t.textTertiary, marginTop: 2, fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyMascot: { width: 160, height: 160, marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: t.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  shareAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: t.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  shareAllBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Bottom template creator dock
  templateBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  templateDockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 46,
    backgroundColor: t.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
    overflow: 'hidden',
  },
  templateDockWrapExpanded: { height: 620 },
  templateDockHandle: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.25)',
  },
  templateDockHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateDockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  templateDockSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  templatePanel: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  templateTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  templateTypePill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    backgroundColor: t.surface,
    paddingVertical: 8,
    alignItems: 'center',
  },
  templateTypePillActive: {
    borderColor: t.primary,
    backgroundColor: t.primaryMuted,
  },
  templateTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
  },
  templateTypeTextActive: {
    color: t.primary,
  },
  templateSearch: {
    backgroundColor: t.inputBg,
    borderColor: t.inputBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: t.textPrimary,
    fontSize: 13,
    marginBottom: 8,
  },
  templateCategoryRow: {
    gap: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  templateCategoryChip: {
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    backgroundColor: t.surface,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateCategoryChipActive: {
    borderColor: t.primary,
    backgroundColor: t.primaryMuted,
  },
  templateCategoryText: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  templateCategoryTextActive: {
    color: t.primary,
  },
  templateLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  templateHint: {
    color: t.textSecondary,
    fontSize: 12,
  },
  templateList: {
    flex: 1,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  templateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  templateItemIcon: { fontSize: 16 },
  templateItemTitle: { fontSize: 13, fontWeight: '700', color: t.textPrimary },
  templateItemDesc: { fontSize: 11, color: t.textSecondary, marginTop: 2 },
  templateScratchBtn: {
    marginTop: 2,
    backgroundColor: t.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  templateScratchBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textPrimary,
  },
  reviewChangeTemplate: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewRow: {
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
    marginBottom: 8,
  },
  reviewPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewPill: {
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: t.surface,
  },
  reviewPillText: {
    fontSize: 12,
    color: t.textSecondary,
    fontWeight: '600',
  },
  reviewDateBtn: {
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    borderRadius: 10,
    backgroundColor: t.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  reviewDateLabel: {
    fontSize: 11,
    color: t.textTertiary,
    marginBottom: 3,
  },
  reviewDateValue: {
    fontSize: 13,
    color: t.textPrimary,
    fontWeight: '700',
  },
  reviewDualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewHalfInput: {
    flex: 1,
  },
  skipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  skipCard: {
    backgroundColor: t.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.cardBorder,
    padding: 14,
  },
  skipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.textPrimary,
    marginBottom: 2,
  },
  skipSubtitle: {
    fontSize: 12,
    color: t.textSecondary,
    marginBottom: 10,
  },
  skipInput: {
    backgroundColor: t.inputBg,
    borderColor: t.inputBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: t.textPrimary,
    fontSize: 13,
  },
  skipReasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  skipReasonChip: {
    backgroundColor: t.primaryMuted,
    borderWidth: 1,
    borderColor: t.primary + '35',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipReasonChipText: {
    color: t.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  skipActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  skipActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: t.surface,
  },
  skipActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
  skipFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  skipFooterBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  skipFooterBtnSecondary: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  skipFooterBtnPrimary: {
    backgroundColor: t.primary,
  },
  skipFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerModalCard: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 16,
    backgroundColor: t.cardBg,
    borderWidth: 1,
    borderColor: t.cardBorder,
    padding: 12,
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: t.textPrimary,
    marginBottom: 8,
  },
  pickerDoneBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerCalendar: {
    alignSelf: 'center',
    transform: [{ scale: 0.92 }],
    marginVertical: -8,
  },
});