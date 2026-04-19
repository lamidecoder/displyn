import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable, RectButton, PanGestureHandler, State } from 'react-native-gesture-handler';
import { supabase } from '../../lib/supabase';
import {
  createTask,
  deleteTask,
  generateTodayInstances,
  getChallengeStats,
  getProfile,
  getWeeklyStats,
  logChallengeProgress,
  updateInstanceStatus,
  detectChallengeEndStates,
  saveChallengeReflection,
  ChallengeOutcome,
  skipTaskInstance,
} from '../../lib/tasks';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parseTaskFromText, getSmartSuggestions, voiceToTask, generateDailyFocus, DailyFocus, ParsedTask, TaskSuggestion, AIRateLimitError, AIUnavailableError } from '../../lib/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { getNeglectedAreas, getPatternSummary, getStreak } from '../../lib/analytics';
import { checkAndAwardBadges, BadgeDef } from '../../lib/badges';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../components/Toast';
import ConfirmSheet from '../../components/ConfirmSheet';
import { useProfile } from '../../lib/ProfileContext';
import { TAG_COLORS, TAG_ICONS } from '../../lib/types';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../lib/PressableScale';
import ShareModal from '../../components/sharing/ShareModal';
import { ShareData } from '../../components/sharing/types';
import NylaFocusOverlay from '../../components/NylaFocusOverlay';

// Icon assets
const ICONS = {
  momentum: require('../../assets/icons/momentum-chart.png'),
  priorityTask: require('../../assets/icons/priority-task-icon.png'),
  voiceMic: require('../../assets/icons/voice-mic.png'),
  addTask: require('../../assets/icons/input-add-task.png'),
  aiGen: require('../../assets/icons/input-ai-gen.png'),
  voiceCoach: require('../../assets/icons/input-voice-coach.png'),
  emptyState: require('../../assets/icons/empty-state-mascot.png'),
  nyla: require('../../assets/icons/nyla-avatar.png'),
};

export default function TodayScreen() {
  const { theme, isDark } = useTheme();
  const toast = useToast();
  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean; title: string; message: string;
    confirmLabel: string; destructive: boolean; icon: string; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', confirmLabel: 'Confirm', destructive: false, icon: 'alert-circle', onConfirm: () => {} });
  const showConfirm = (cfg: Omit<typeof confirmSheet, 'visible'>) => setConfirmSheet({ ...cfg, visible: true });
  const hideConfirm = () => setConfirmSheet(prev => ({ ...prev, visible: false }));
  const { profile: cachedProfile } = useProfile();
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [weeklyStats, setWeeklyStats] = useState<any>({
    rate: 0, completed: 0, missed: 0, total: 0, dailyData: [],
  });

  // Main tabs & sub-mode
  const [activeTab, setActiveTab] = useState<'add' | 'ai' | 'voice'>('add');
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio');

  // Challenge log modal state
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logModalTask, setLogModalTask] = useState<any>(null);
  const [logModalInstanceId, setLogModalInstanceId] = useState<string>('');
  const [logAmount, setLogAmount] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [challengeStatsMap, setChallengeStatsMap] = useState<Record<string, any>>({});

  // Text input for AI/Voice text mode
  const [textInput, setTextInput] = useState('');
  const [textParsing, setTextParsing] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // AI Error state (inline fallback instead of popups)
  const [aiError, setAiError] = useState<{ type: 'rate_limit' | 'unavailable' | 'generic'; message: string } | null>(null);

  // Challenge end-state modal
  const [challengeOutcomes, setChallengeOutcomes] = useState<ChallengeOutcome[]>([]);
  const [outcomeModalVisible, setOutcomeModalVisible] = useState(false);
  const [currentOutcomeIdx, setCurrentOutcomeIdx] = useState(0);
  const [outcomeReflection, setOutcomeReflection] = useState('');
  const [outcomeMood, setOutcomeMood] = useState<string | null>(null);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [userTone, setUserTone] = useState<string>('soft_coach');

  // Share
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [parsedTasksReview, setParsedTasksReview] = useState<any[]>([]);
  const [parsedReviewVisible, setParsedReviewVisible] = useState(false);
  const [parsedSaving, setParsedSaving] = useState(false);

  // Daily Focus Overlay
  const [focusData, setFocusData] = useState<DailyFocus | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusLoading, setFocusLoading] = useState(false);
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

  const [today, setToday] = useState(() => new Date().toISOString().split('T')[0]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const loadToday = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [instanceData, stats, profile] = await Promise.all([
        generateTodayInstances(user.id, today),
        getWeeklyStats(user.id),
        getProfile(user.id),
      ]);
      setInstances(instanceData || []);
      setWeeklyStats(stats);
      setDisplayName(profile?.display_name || 'there');

      const challengeInstances = (instanceData || []).filter(
        (i: any) => i.task?.task_type === 'challenge'
      );
      if (challengeInstances.length > 0) {
        const statsEntries = await Promise.all(
          challengeInstances.map(async (inst: any) => {
            try {
              const cs = await getChallengeStats(inst.task_id, user.id);
              return [inst.task_id, cs] as [string, any];
            } catch { return null; }
          })
        );
        const map: Record<string, any> = {};
        statsEntries.forEach((entry) => { if (entry) map[entry[0]] = entry[1]; });
        setChallengeStatsMap(map);
      }

      // Check for new badge unlocks
      try {
        const streak = await getStreak(user.id);
        const newBadges = await checkAndAwardBadges(user.id, streak);
        if (newBadges.length > 0) {
          const top = newBadges[newBadges.length - 1];
          toast.success(`${top.icon} Badge unlocked!`, `You earned "${top.title}"`);
        }
      } catch {}

      // Detect challenge end states (completed or failed)
      try {
        const outcomes = await detectChallengeEndStates(user.id);
        if (outcomes.length > 0) {
          setChallengeOutcomes(outcomes);
          setCurrentOutcomeIdx(0);
          setOutcomeReflection('');
          setOutcomeMood(null);
          setOutcomeModalVisible(true);
        }
        // Store user's tone for Nyla messaging
        if (profile?.notification_tone) {
          setUserTone(profile.notification_tone);
        }
      } catch {}
    } catch (error: any) {
      console.error('Error loading today:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Re-fetch when app comes back to foreground + detect midnight date change
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const now = new Date().toISOString().split('T')[0];
        if (now !== today) {
          setToday(now);
        } else {
          loadToday();
        }
      }
    });
    return () => sub.remove();
  }, [today, loadToday]);

  // Midnight timer — check every 60s if the date has rolled over
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString().split('T')[0];
      if (now !== today) {
        setToday(now);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  // ===== Daily Focus — auto-show on first open, toggle via icon =====
  const focusLoadedRef = useRef(false);

  const fetchFocusData = useCallback(async () => {
    if (focusLoading || focusData) return;
    setFocusLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFocusLoading(false); return; }

      const pendingTasks = instances.filter((i: any) => i.status === 'pending');
      const allTaskTitles = pendingTasks.map((i: any) => i.task?.title || 'Untitled');
      const overdueTaskTitles = instances
        .filter((i: any) => i.status === 'pending' && (i.overdue_days || 0) > 0)
        .map((i: any) => i.task?.title || 'Untitled');
      const priorityTasks = instances
        .filter((i: any) => i.is_priority && i.status === 'pending')
        .map((i: any) => i.task?.title || 'Untitled');

      const challengesDueSoon: { title: string; daysLeft: number }[] = [];
      const challengeInsts = instances.filter((i: any) => i.task?.task_type === 'challenge' && i.task?.deadline);
      for (const ci of challengeInsts) {
        const dl = new Date(ci.task.deadline + 'T00:00:00');
        const diff = Math.ceil((dl.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0 && diff <= 3) {
          challengesDueSoon.push({ title: ci.task.title, daysLeft: diff });
        }
      }

      const comp7d = weeklyStats?.rate || 0;
      let streak = 0;
      try { streak = await getStreak(user.id); } catch {}

      const focus = await generateDailyFocus({
        name: displayName || 'there',
        tone: userTone,
        allTasks: allTaskTitles,
        overdueTasks: overdueTaskTitles,
        challengesDueSoon,
        completionRate7d: comp7d,
        streak,
        priorityTasks,
      }, cachedProfile);

      setFocusData(focus);
    } catch (e: any) {
      console.log('Focus generation failed:', e.message);
      const pending = instances.filter((i: any) => i.status === 'pending');
      const taskNames = pending.slice(0, 3).map((i: any) => i.task?.title || 'Untitled').join(', ');
      setFocusData({ message: `${displayName || 'Hey'}, you have ${pending.length} task${pending.length !== 1 ? 's' : ''} today${taskNames ? ': ' + taskNames : ''}. Let's get moving.` });
    } finally {
      setFocusLoading(false);
    }
  }, [focusData, focusLoading, instances, weeklyStats, displayName, userTone]);

  // Auto-show on first app open of the day
  useEffect(() => {
    if (loading || instances.length === 0 || focusLoadedRef.current) return;
    focusLoadedRef.current = true;

    const autoShowFocus = async () => {
      const key = `focus_dismissed_${today}`;
      const dismissed = await AsyncStorage.getItem(key);
      if (dismissed === 'true') return;

      setTimeout(() => {
        setFocusVisible(true);
        fetchFocusData();
      }, 1000);
    };
    autoShowFocus();
  }, [loading, instances.length > 0]);

  const toggleFocus = () => {
    if (focusVisible) {
      setFocusVisible(false);
    } else {
      setFocusVisible(true);
      if (!focusData) fetchFocusData();
    }
  };

  const dismissFocus = async () => {
    setFocusVisible(false);
    const key = `focus_dismissed_${today}`;
    await AsyncStorage.setItem(key, 'true');
  };

  // ===== Swipe between input tabs =====
  const TAB_ORDER: ('add' | 'ai' | 'voice')[] = ['add', 'ai', 'voice'];

  const handleInputSwipe = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const { translationX, velocityX } = nativeEvent;
      // Only trigger if significant horizontal swipe (not accidental)
      if (Math.abs(translationX) > 40 || Math.abs(velocityX) > 300) {
        const currentIdx = TAB_ORDER.indexOf(activeTab);
        if (translationX < 0 && currentIdx < TAB_ORDER.length - 1) {
          // Swipe left → next tab
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setActiveTab(TAB_ORDER[currentIdx + 1]);
          setTextInput('');
          setAiError(null);
        } else if (translationX > 0 && currentIdx > 0) {
          // Swipe right → previous tab
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setActiveTab(TAB_ORDER[currentIdx - 1]);
          setTextInput('');
          setAiError(null);
        }
      }
    }
  };

  // ===== Challenge End-State Handler =====
  const currentOutcome = challengeOutcomes[currentOutcomeIdx] || null;

  const getNylaOutcomeMessage = (outcome: ChallengeOutcome) => {
    const isFailed = outcome.outcome === 'failed';
    const pct = outcome.percentage;

    if (!isFailed) {
      if (userTone === 'savage_mode') return `You actually did it. ${outcome.targetAmount} ${outcome.targetUnit}. I'm impressed — don't let it get to your head.`;
      if (userTone === 'strict_mentor') return `Target met. ${outcome.targetAmount} ${outcome.targetUnit} — that's the discipline I expect. What worked?`;
      if (userTone === 'comedic') return `Wait... you actually finished?! ${outcome.targetAmount} ${outcome.targetUnit} done! You legend. Tell me your secret.`;
      return `You did it! ${outcome.targetAmount} ${outcome.targetUnit} complete. I'm proud of you. What helped you stay on track?`;
    }

    if (userTone === 'savage_mode') return `${pct}% out of 100%. You fell short. No sugarcoating. What happened?`;
    if (userTone === 'strict_mentor') return `You reached ${outcome.currentProgress}/${outcome.targetAmount} ${outcome.targetUnit}. The deadline has passed. Let's understand what got in the way.`;
    if (userTone === 'comedic') return `${outcome.currentProgress} out of ${outcome.targetAmount} ${outcome.targetUnit}... that's a solid attempt. But the deadline said goodbye. What went wrong?`;
    return `You reached ${outcome.currentProgress} out of ${outcome.targetAmount} ${outcome.targetUnit}. The deadline has passed, but that's okay — what got in the way?`;
  };

  const handleSaveOutcomeReflection = async () => {
    if (!currentOutcome) return;
    if (currentOutcome.outcome === 'failed' && !outcomeReflection.trim()) {
      toast.info('Reflection required', 'Take a moment to reflect on what happened before moving on.'); return;
      return;
    }
    setOutcomeSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await saveChallengeReflection(
        user.id,
        currentOutcome.taskId,
        currentOutcome.outcome,
        outcomeReflection.trim(),
        outcomeMood,
        currentOutcome.currentProgress,
        currentOutcome.targetAmount,
      );

      // Move to next outcome or close modal
      if (currentOutcomeIdx < challengeOutcomes.length - 1) {
        setCurrentOutcomeIdx(currentOutcomeIdx + 1);
        setOutcomeReflection('');
        setOutcomeMood(null);
      } else {
        setOutcomeModalVisible(false);
        setChallengeOutcomes([]);
        await loadToday();
      }
    } catch (e: any) {
      toast.error('Something went wrong', 'Could not save reflection.');
    } finally {
      setOutcomeSaving(false);
    }
  };

  const outcomeMoods = [
    { key: 'proud', emoji: '😊', label: 'Proud' },
    { key: 'relieved', emoji: '😮‍💨', label: 'Relieved' },
    { key: 'neutral', emoji: '😐', label: 'Neutral' },
    { key: 'disappointed', emoji: '😔', label: 'Disappointed' },
    { key: 'frustrated', emoji: '😤', label: 'Frustrated' },
    { key: 'motivated', emoji: '🔥', label: 'Motivated' },
  ];

  const handleComplete = async (id: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await updateInstanceStatus(id, 'completed');
      await loadToday();
    } catch (e: any) {
      // Silence backend config errors that don't affect the user experience
      if (e.message && e.message.includes('service_role_key')) return;
      if (e.message && e.message.includes('unrecognized configuration')) return;
      toast.error('Something went wrong', e.message);
    }
  };
  const handleMiss = async (id: string) => {
    try { await updateInstanceStatus(id, 'missed'); await loadToday(); }
    catch (e: any) {
      if (e.message && (e.message.includes('service_role_key') || e.message.includes('unrecognized configuration'))) return;
      toast.error('Something went wrong', e.message);
    }
  };
  const openSkipFlow = (id: string) => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    setSkipInstanceId(id);
    setSkipReason('');
    setSkipNote('');
    setSkipAction('missed');
    setSkipDate(tmr.toISOString().split('T')[0]);
    setShowSkipDatePicker(false);
    setSkipVisible(true);
  };
  const closeSkipFlow = () => {
    if (skipSaving) return;
    setSkipVisible(false);
    setSkipInstanceId(null);
    setSkipReason('');
    setSkipNote('');
    setShowSkipDatePicker(false);
  };
  const submitSkipFlow = async () => {
    if (!skipInstanceId) return;
    if (!skipReason.trim()) {
      toast.warning('Reason required', 'Please tell Nyla why you are skipping this task.'); return;
      return;
    }
    setSkipSaving(true);
    try {
      await skipTaskInstance(skipInstanceId, {
        reason: skipReason.trim(),
        note: skipNote.trim() || null,
        rescheduledTo: skipAction === 'rescheduled' ? skipDate : null,
      });
      closeSkipFlow();
      await loadToday();
    } catch (e: any) {
      toast.error('Something went wrong', 'Could not skip task');
    } finally {
      setSkipSaving(false);
    }
  };
  const handleSnooze = async (id: string) => {
    try {
      const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      await updateInstanceStatus(id, 'snoozed', tmr.toISOString().split('T')[0]);
      await loadToday();
    } catch (e: any) { toast.error('Something went wrong', e.message); }
  };

  const openChallengeLog = (inst: any) => {
    setLogModalTask(inst.task);
    setLogModalInstanceId(inst.id);
    setLogAmount('');
    setLogModalVisible(true);
  };

  const handleChallengeLog = async () => {
    if (!logAmount || isNaN(Number(logAmount)) || Number(logAmount) <= 0) {
      toast.error('Oops', 'Enter a valid amount'); return;
    }
    setLogLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await logChallengeProgress(logModalTask.id, user.id, Number(logAmount), today);
      setLogModalVisible(false);
      await loadToday();
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    } finally {
      setLogLoading(false);
    }
  };

  // ===== Text -> AI Parse (with review step) =====
  const handleTextParse = async () => {
    if (!textInput.trim()) {
      toast.warning('Nothing here', 'Type a task description first.');
      return;
    }
    setTextParsing(true);
    setAiError(null);
    try {
      const parsed = await parseTaskFromText(textInput.trim(), cachedProfile);
      const tasks = Array.isArray(parsed) ? parsed : [parsed];
      setParsedTasksReview(tasks);
      setParsedReviewVisible(true);
    } catch (e: any) {
      if (e instanceof AIRateLimitError) {
        setAiError({ type: 'rate_limit', message: 'You\'ve reached your daily AI limit (40 calls). Try again tomorrow.' });
      } else if (e instanceof AIUnavailableError) {
        setAiError({ type: 'unavailable', message: 'Nyla is temporarily unavailable. Please try again in a moment.' });
      } else {
        setAiError({ type: 'generic', message: e.message || 'Could not create tasks. Please try again.' });
      }
    } finally {
      setTextParsing(false);
    }
  };

  // ===== Save reviewed parsed tasks =====
  const saveParsedTasks = async () => {
    setParsedSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await Promise.all(parsedTasksReview.map(task =>
        createTask({
          user_id: user.id,
          title: task.title,
          notes: task.notes || null,
          task_type: task.task_type,
          recurrence_rule: task.recurrence_rule || null,
          custom_days: task.custom_days || null,
          time_block: task.time_block,
          deadline: task.deadline || null,
          tags: task.tags || [],
          is_active: true,
          target_amount: task.target_amount || null,
          target_unit: task.target_unit || null,
        })
      ));
      setParsedReviewVisible(false);
      setParsedTasksReview([]);
      setTextInput('');
      loadToday();
      toast.success(`${parsedTasksReview.length > 1 ? parsedTasksReview.length + ' tasks' : 'Task'} added!`);
    } catch (e: any) {
      toast.error('Could not save tasks', e.message);
    } finally {
      setParsedSaving(false);
    }
  };

  // ===== Voice Recording =====
  const startPulse = () => {
    pulseAnim.setValue(0);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    pulseAnim.setValue(0);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        toast.warning('Permission needed', 'Please allow microphone access to use voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      startPulse();
    } catch (e: any) {
      console.error('Failed to start recording:', e.message);
      toast.error('Oops', 'Could not start recording. Please try again.');
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);
    stopPulse();
    setIsTranscribing(true);
    setAiError(null);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No recording URI');

      // Single server-side call: Whisper transcription + GPT parsing
      const result = await voiceToTask(uri, cachedProfile);

      if (!result.transcription.trim()) {
        toast.warning('No speech detected', 'We could not pick up any speech. Try again.');
        return;
      }

      if (!result.tasks.length) {
        setAiError({ type: 'generic', message: 'Could not parse tasks from your speech. Please try again.' });
        return;
      }

      // Save all tasks in parallel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      await Promise.all(result.tasks.map(task =>
        createTask({
          user_id: user.id,
          title: task.title,
          notes: task.notes || null,
          task_type: task.task_type,
          recurrence_rule: task.recurrence_rule || null,
          custom_days: task.custom_days || null,
          time_block: task.time_block,
          deadline: task.deadline || null,
          tags: task.tags || [],
          is_active: true,
          target_amount: task.target_amount || null,
          target_unit: task.target_unit || null,
        })
      ));

      loadToday();
    } catch (e: any) {
      console.log('Voice task error:', e.message);
      if (e instanceof AIRateLimitError) {
        setAiError({ type: 'rate_limit', message: 'You\'ve reached your daily AI limit (40 calls). Try again tomorrow.' });
      } else if (e instanceof AIUnavailableError) {
        setAiError({ type: 'unavailable', message: 'Nyla is temporarily unavailable. Please try again in a moment.' });
      } else {
        setAiError({ type: 'generic', message: e.message || 'Could not process voice input. Please try again.' });
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      stopRecordingAndProcess();
    } else {
      startRecording();
    }
  };

  // ===== Smart Suggestions =====
  const handleLoadSuggestions = async () => {
    setSuggestionsLoading(true);
    setAiError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [ps, na] = await Promise.all([
        getPatternSummary(user.id, 30),
        getNeglectedAreas(user.id, 30),
      ]);
      const activeTasks = instances
        .filter((i: any) => i.task)
        .map((i: any) => i.task.title);
      const neglectedTags = (na || []).map((n: any) => n.tag);
      const topAreas = (ps?.topThree || []).map((t: any) => t.tag);
      const result = await getSmartSuggestions(activeTasks, neglectedTags, topAreas, cachedProfile);
      setSuggestions(result);
      setSuggestionsLoaded(true);
    } catch (e: any) {
      console.error('Suggestions error:', e.message);
      if (e instanceof AIRateLimitError) {
        setAiError({ type: 'rate_limit', message: 'You\'ve reached your daily AI limit (40 calls). Try again tomorrow.' });
      } else if (e instanceof AIUnavailableError) {
        setAiError({ type: 'unavailable', message: 'Nyla is temporarily unavailable. Please try again in a moment.' });
      } else {
        setAiError({ type: 'generic', message: 'Could not load suggestions. Try again later.' });
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: TaskSuggestion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await createTask({
        user_id: user.id,
        title: suggestion.title,
        notes: null,
        task_type: suggestion.task_type,
        recurrence_rule: suggestion.task_type === 'recurring' ? 'daily' : null,
        time_block: suggestion.time_block,
        tags: suggestion.tags,
        is_active: true,
        deadline: null,
        target_amount: null,
        target_unit: null,
      });
      // Remove the accepted suggestion from the list
      setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
      await loadToday();
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    }
  };

  const completedCount = instances.filter((i) => i.status === 'completed').length;
  const totalCount = instances.length;
  const priorityTasks = instances.filter((i) => i.is_priority && i.status === 'pending');

  const getHealth = () => {
    if (weeklyStats.rate >= 80) return { label: 'Healthy', color: theme.success };
    if (weeklyStats.rate >= 50) return { label: 'Needs Work', color: theme.warning };
    return { label: 'Critical', color: theme.error };
  };
  const health = getHealth();

  const s = makeStyles(theme, isDark);

  // Tab config for input section
  const getTabConfig = () => {
    switch (activeTab) {
      case 'add': return { label: 'Speak your task', textLabel: 'Type your task', placeholder: 'e.g. Go to the gym every Monday and Wednesday' };
      case 'ai': return { label: 'Speak your goal', textLabel: 'Describe your goal', placeholder: 'e.g. Read 500 pages of Atomic Habits by March 30' };
      case 'voice': return { label: 'Speak to your coach', textLabel: 'Describe what you want to do', placeholder: 'e.g. I want to start meditating daily in the mornings' };
    }
  };
  const tabConfig = getTabConfig();

  // ===== Delete handler for one-time tasks (1-hour grace) =====
  const handleDeleteOneTimeTask = (taskId: string, taskTitle: string, taskCreatedAt: string | null) => {
    const createdTime = taskCreatedAt ? new Date(taskCreatedAt).getTime() : 0;
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const withinGrace = (now - createdTime) < oneHourMs;

    if (withinGrace) {
      showConfirm({
        title: 'Delete Task',
        message: `Delete "${taskTitle}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
        icon: 'trash-outline',
        onConfirm: async () => { hideConfirm(); try { await deleteTask(taskId); loadToday(); } catch (e: any) { toast.error('Something went wrong', e.message); } },
      });
    } else {
      showConfirm({
        title: 'Impact Warning',
        message: `"${taskTitle}" was logged over an hour ago. Deleting it will affect your behavioural insights.`,
        confirmLabel: 'Delete Anyway',
        destructive: true,
        icon: 'warning-outline',
        onConfirm: async () => { hideConfirm(); try { await deleteTask(taskId); loadToday(); } catch (e: any) { toast.error('Something went wrong', e.message); } },
      });
    }
  };

  // ===== Render the unified input card (sub-tabs + content inside) =====
  const renderInputCard = () => {
    const isAudio = inputMode === 'audio';

    // AI Generator tab: no text input, just a suggest button
    if (activeTab === 'ai') {
      return (
        <View style={s.inputCard}>
          <View style={s.inputCardContent}>
            <Image source={ICONS.nyla} style={{ width: 48, height: 48, marginBottom: 10, backgroundColor: 'transparent' }} resizeMode="contain" />
            <Text style={s.voiceLabel}>Nyla's Suggestions</Text>
            <Text style={[s.voiceSub, { marginBottom: 16 }]}>Get personalised suggestions based on your habits</Text>
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnPrimary, { width: '100%' }, suggestionsLoading && { opacity: 0.6 }]}
              onPress={handleLoadSuggestions}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[s.actionBtnText, { color: '#fff' }]}>
                  {suggestionsLoaded ? 'Refresh Suggestions' : 'Suggest Tasks'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Nyla Coach tab: Coming Soon
    if (activeTab === 'voice') {
      return (
        <View style={s.inputCard}>
          <View style={[s.inputCardContent, { paddingVertical: 32 }]}>
            <Image
              source={ICONS.nyla}
              style={{ width: 72, height: 72, marginBottom: 16, backgroundColor: 'transparent' }}
              resizeMode="contain"
            />
            <Text style={[s.voiceLabel, { fontSize: 18 }]}>Coming Soon</Text>
            <Text style={s.voiceSub}>Coach Nyla is on its way. Stay tuned!</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={s.inputCard}>
        {/* Sub-tabs inside the card */}
        <View style={s.subTabRow}>
          <TouchableOpacity onPress={() => setInputMode('audio')}>
            <Text style={[s.subTabText, isAudio && s.subTabTextActive]}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setInputMode('text')}>
            <Text style={[s.subTabText, !isAudio && s.subTabTextActive]}>Use Text</Text>
          </TouchableOpacity>
        </View>

        {/* Audio mode content */}
        {isAudio && (
          <View style={s.inputCardContent}>
            {isTranscribing ? (
              <>
                <Image source={ICONS.nyla} style={{ width: 48, height: 48, marginBottom: 8, backgroundColor: 'transparent' }} resizeMode="contain" />
                <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 8 }} />
                <Text style={s.voiceLabel}>Nyla is transcribing...</Text>
                <Text style={s.voiceSub}>Nyla is logging your tasks</Text>
              </>
            ) : (
              <>
                <View style={s.micContainer}>
                  {isRecording && (
                    <>
                      <Animated.View style={[s.pulseRing, {
                        borderColor: theme.primary,
                        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                      }]} />
                      <Animated.View style={[s.pulseRing, {
                        borderColor: theme.primary,
                        opacity: pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.4, 0] }),
                        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                      }]} />
                    </>
                  )}
                  <TouchableOpacity
                    onPress={handleMicPress}
                    activeOpacity={0.7}
                    style={[s.micButton, isRecording && { backgroundColor: theme.error }]}
                  >
                    <Ionicons name="mic" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={s.voiceLabel}>
                  {isRecording ? 'Listening...' : 'Tap to speak'}
                </Text>
                <Text style={s.voiceSub}>
                  {isRecording ? 'Tap again when you\'re done' : 'Describe your tasks naturally'}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Text mode content */}
        {!isAudio && (
          <View style={s.inputCardContent}>
            <TextInput
              style={s.aiTextInput}
              placeholder={tabConfig.placeholder}
              placeholderTextColor={theme.textTertiary}
              value={textInput}
              onChangeText={setTextInput}
              multiline
              numberOfLines={2}
            />
            {activeTab === 'add' ? (
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <PressableScale
                  style={[s.actionBtn, s.actionBtnSecondary]}
                  onPress={() => router.push('/add-task')}
                  scaleValue={0.95}
                >
                  <Text style={[s.actionBtnText, { color: theme.textPrimary }]}>Manual Form</Text>
                </PressableScale>
                <PressableScale
                  style={[s.actionBtn, s.actionBtnPrimary, textParsing && { opacity: 0.6 }]}
                  onPress={handleTextParse}
                  disabled={textParsing}
                  scaleValue={0.95}
                >
                  {textParsing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[s.actionBtnText, { color: '#fff' }]}>AI Create</Text>
                  )}
                </PressableScale>
              </View>
            ) : (
              <PressableScale
                style={[s.actionBtn, s.actionBtnPrimary, { width: '100%' }, textParsing && { opacity: 0.6 }]}
                onPress={handleTextParse}
                disabled={textParsing}
                scaleValue={0.95}
              >
                {textParsing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[s.actionBtnText, { color: '#fff' }]}>Create Task</Text>
                )}
              </PressableScale>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadToday(); }} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO HEADER ===== */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerDate}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
              </Text>
              <Text style={s.headerTitle}>{getGreeting()},</Text>
              <Text style={s.headerName}>{displayName}</Text>
            </View>
            <PressableScale style={s.greetingIconBox} onPress={toggleFocus} scaleValue={0.92}>
              <Ionicons name="sparkles-outline" size={20} color={isDark ? '#FFFFFF' : '#111111'} />
            </PressableScale>
          </View>
          <View style={s.greetingRow}>
            <View style={s.progressBarTrackWrap}>
              <View style={[s.progressBarFillWrap, {
                width: totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : '0%'
              }]} />
            </View>
            <Text style={s.headerTaskCount}>{completedCount}/{totalCount}</Text>
          </View>
        </View>

        {/* Focus overlay rendered outside ScrollView at component root */}

        {/* ===== MOMENTUM CARD ===== */}
        <View style={s.momentumCard}>
          <View style={s.momentumHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={ICONS.momentum} style={s.momentumIcon} />
              <Text style={s.momentumTitle}>Momentum</Text>
            </View>
            <View style={s.healthBadge}>
              <View style={[s.healthDot, { backgroundColor: health.color }]} />
              <Text style={[s.healthLabel, { color: health.color }]}>{health.label}</Text>
            </View>
          </View>
          <View style={s.barsRow}>
            {weeklyStats.dailyData.length > 0 ? (
              weeklyStats.dailyData.map((day: any, i: number) => {
                const barHeight = Math.max(day.rate, 8);
                const isActive = day.rate >= 50;
                return (
              <View key={i} style={s.barCol}>
                <View style={s.barTrack}>
                  <View style={[s.barFill, {
                        height: `${barHeight}%`,
                        backgroundColor: isActive ? theme.primary : (isDark ? '#2A2A38' : '#D5D5DD'),
                  }]} />
                </View>
                    <Text style={s.barLabel}>
                      {Math.round(day.rate)}
                    </Text>
              </View>
                );
              })
            ) : (
              Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={s.barCol}>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { height: '8%', backgroundColor: isDark ? '#2A2A38' : '#D5D5DD' }]} />
                  </View>
                  <Text style={s.barLabel}>0</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ===== PRIORITY TASKS ===== */}
        {priorityTasks.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Priority Tasks</Text>
            {priorityTasks.slice(0, 3).map((inst) => {
              const tag = inst.task?.tags?.[0];
              const tc = tag ? TAG_COLORS[tag as keyof typeof TAG_COLORS] : theme.primary;
              const ti = tag ? TAG_ICONS[tag as keyof typeof TAG_ICONS] : '🎯';
              const isOneTime = inst.task?.task_type === 'one_time';
              const overdueDays = isOneTime ? (inst.overdue_days || 0) : 0;
              const overdueColor = overdueDays >= 3 ? '#EF4444' : overdueDays === 2 ? '#F97316' : overdueDays === 1 ? '#EAB308' : null;
              return (
                <View key={inst.id} style={[s.priorityCard, { borderLeftColor: theme.primary, borderLeftWidth: 3 }]}>
                  <View style={[s.priorityIconInner, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={s.priorityIconEmoji}>{ti || '🎯'}</Text>
                  </View>
                  <View style={s.priorityTextBlock}>
                    <Text style={s.priorityTitle} numberOfLines={1}>{inst.task?.title}</Text>
                    <View style={s.priorityMetaRow}>
                      <View style={[s.tagPillOutline, { borderColor: theme.primaryBorder }]}>
                        <Text style={[s.tagPillOutlineText, { color: theme.textSecondary }]}>{tag || 'Untagged'}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.priorityActionsRow}>
                    <TouchableOpacity
                      style={[s.priorityDoneBtn, { backgroundColor: theme.primary }]}
                      onPress={() => handleComplete(inst.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.skipBtn} onPress={() => openSkipFlow(inst.id)}>
                      <Ionicons name="close" size={13} color={isDark ? '#44445A' : '#AAAABC'} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== INPUT TABS (underline style) ===== */}
        <View style={s.inputTabsRow}>
          {([
            { key: 'add' as const, icon: ICONS.addTask, label: 'Add task', disabled: false },
            { key: 'ai' as const, icon: ICONS.aiGen, label: 'Task Suggestion', disabled: false },
            { key: 'voice' as const, icon: ICONS.voiceCoach, label: 'Coach Nyla', disabled: false },
          ]).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <PressableScale
                key={tab.key}
                style={s.inputTab}
                onPress={() => { setActiveTab(tab.key); setTextInput(''); setAiError(null); }}
                scaleValue={0.95}
              >
                <View style={s.inputTabInner}>
                  <Image
                    source={tab.icon}
                    style={[s.inputTabIcon, { tintColor: isActive ? theme.textPrimary : theme.textTertiary }]}
                  />
                  <Text style={[s.inputTabLabel, isActive && s.inputTabLabelActive]}>
                    {tab.label}
              </Text>
                </View>
                {isActive && <View style={s.inputTabUnderline} />}
              </PressableScale>
            );
          })}
        </View>

        {/* ===== UNIFIED INPUT CARD (sub-tabs + content inside) ===== */}
        <PanGestureHandler
          onHandlerStateChange={handleInputSwipe}
          activeOffsetX={[-20, 20]}
          failOffsetY={[-15, 15]}
        >
          <View>{renderInputCard()}</View>
        </PanGestureHandler>

        {/* ===== AI ERROR BANNER ===== */}
        {aiError && (
          <View style={[s.aiErrorBanner, aiError.type === 'rate_limit' ? s.aiErrorBannerLimit : s.aiErrorBannerGeneric]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={ICONS.nyla} style={{ width: 32, height: 32, backgroundColor: 'transparent' }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={[s.aiErrorTitle, aiError.type === 'rate_limit' ? { color: '#F59E0B' } : { color: '#EF4444' }]}>
                  {aiError.type === 'rate_limit' ? 'Daily Limit Reached' : aiError.type === 'unavailable' ? 'Nyla is Unavailable' : 'Something Went Wrong'}
                </Text>
                <Text style={s.aiErrorMessage}>{aiError.message}</Text>
            </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
              {aiError.type !== 'rate_limit' && (
                <TouchableOpacity
                  onPress={() => {
                    setAiError(null);
                    if (activeTab === 'ai') handleLoadSuggestions();
                  }}
                  style={s.aiErrorRetryBtn}
                >
                  <Text style={s.aiErrorRetryText}>Retry</Text>
          </TouchableOpacity>
        )}
              <TouchableOpacity onPress={() => setAiError(null)}>
                <Text style={[s.aiErrorDismissText, { color: theme.textTertiary }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== AI SUGGESTIONS (on AI Generator tab) ===== */}
        {activeTab === 'ai' && (
        <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={s.sectionLabel}>Nyla's Suggestions</Text>
              {suggestionsLoaded && (
                <TouchableOpacity onPress={() => { setSuggestions([]); setSuggestionsLoaded(false); }}>
                  <Text style={{ color: theme.textTertiary, fontSize: 13, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
              )}
          </View>

            {suggestions.map((sug, i) => (
              <View key={i} style={s.suggestionCard}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={s.taskCardTitle}>{sug.title}</Text>
                  <Text style={s.taskCardMeta}>{sug.reason}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <View style={[s.tagPillOutline, { borderColor: theme.primary + '50' }]}>
                      <Text style={[s.tagPillOutlineText, { color: theme.primary }]}>
                        {sug.task_type === 'one_time' ? 'One-time' : sug.task_type === 'recurring' ? 'Recurring' : 'Challenge'}
                      </Text>
                    </View>
                    <View style={[s.tagPillOutline, { borderColor: theme.textTertiary + '50' }]}>
                      <Text style={[s.tagPillOutlineText, { color: theme.textSecondary }]}>
                        {sug.tags?.[0] || 'General'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                    style={s.suggestionAddBtn}
                    onPress={() => handleAcceptSuggestion(sug)}
              >
                    <Text style={s.suggestionAddBtnText}>Add</Text>
              </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSuggestions(suggestions.filter((_, idx) => idx !== i))}
                  >
                    <Text style={{ color: theme.textTertiary, fontSize: 18, fontWeight: '300' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== TASK LIST ===== */}
        <View style={s.section}>
          <View style={s.taskListHeader}>
            <Text style={s.sectionLabel}>Task List</Text>
            <Text style={s.taskListCount}>{completedCount}/{totalCount}</Text>
          </View>

          {/* Empty state */}
          {instances.length === 0 && !loading && (
            <View style={s.emptyState}>
              <Image source={ICONS.emptyState} style={s.emptyStateImage} />
              <Text style={s.emptyStateTitle}>No tasks yet</Text>
              <TouchableOpacity style={s.emptyStateBtn} onPress={() => router.push('/add-task')}>
                <Text style={s.emptyStateBtnText}>+ Add new task</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Task cards */}
          {instances.map((inst) => {
            const tag = inst.task?.tags?.[0];
            const tc = tag ? TAG_COLORS[tag as keyof typeof TAG_COLORS] : theme.primary;
            const ti = tag ? TAG_ICONS[tag as keyof typeof TAG_ICONS] : null;
            const done = inst.status === 'completed';
            const missed = inst.status === 'missed';
            const snoozed = inst.status === 'snoozed';
            const isRecurring = inst.task?.task_type === 'recurring';
            const isChallenge = inst.task?.task_type === 'challenge';
            const cStats = isChallenge ? challengeStatsMap[inst.task_id] : null;

            if (isChallenge) {
            return (
                <View key={inst.id} style={[s.taskCard, { flexDirection: 'column', alignItems: 'stretch' }, done && { opacity: 0.6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[s.taskIconCircle, { backgroundColor: tc + '20' }]}>
                      {ti ? <Text style={{ fontSize: 16 }}>{ti}</Text> : <View style={[s.taskDotInner, { backgroundColor: tc }]} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.taskCardTitle, done && s.taskCardTitleDone]}>{inst.task?.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={[s.tagPill, { backgroundColor: theme.warning + '20' }]}>
                          <Text style={[s.tagPillText, { color: theme.warning }]}>Challenge</Text>
                        </View>
                        {cStats && (
                          <Text style={s.taskCardMeta}>
                            {cStats.currentProgress}/{cStats.targetAmount} {cStats.targetUnit} · {cStats.daysLeft}d left
                  </Text>
                        )}
                      </View>
                </View>
                {inst.status === 'pending' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity style={s.skipBtn} onPress={() => openSkipFlow(inst.id)}>
                      <Text style={s.skipBtnText}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.doneBtn, { backgroundColor: theme.primary }]} onPress={() => openChallengeLog(inst)}>
                      <Text style={s.doneBtnText}>Log</Text>
                    </TouchableOpacity>
                  </View>
                )}
                    {done && <Text style={s.statusDone}>Logged</Text>}
                  </View>
                  {cStats && (
                    <View style={{ marginTop: 14 }}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${Math.min(cStats.percentage, 100)}%`, backgroundColor: theme.primary }]} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={s.progressLabel}>{cStats.percentage}%</Text>
                        <Text style={s.progressLabel}>Target today: {cStats.dailyTarget} {cStats.targetUnit}</Text>
                      </View>
                    </View>
                  )}
              </View>
            );
            }

            const isOneTime = inst.task?.task_type === 'one_time';

            // Overdue escalation for one-time tasks
            const overdueDays = isOneTime ? (inst.overdue_days || 0) : 0;
            const overdueColor = overdueDays >= 3 ? '#EF4444' : overdueDays === 2 ? '#F97316' : overdueDays === 1 ? '#EAB308' : null;
            const overdueLabel = overdueDays >= 3
              ? `This task is ${overdueDays} days overdue. Critically overdue tasks are prioritised and affect your insights.`
              : overdueDays === 2
              ? 'This task is 2 days overdue. It will escalate to critical tomorrow if not completed.'
              : overdueDays === 1
              ? 'This task is 1 day overdue. Complete it soon to maintain your streak.'
              : '';

            const taskCardContent = (
              <TouchableOpacity
                style={[s.taskCard, done && s.taskCardDone, missed && s.taskCardDone]}
                activeOpacity={isRecurring ? 0.75 : 1}
                onPress={() => isRecurring && router.push({ pathname: '/task-detail', params: { taskId: inst.task_id } })}
              >
                <View style={[s.taskAccentBar, { backgroundColor: done ? (isDark ? '#2A2A38' : '#E0E0E8') : theme.primary }]} />
                <View style={[s.taskIconCircle, { backgroundColor: done ? (isDark ? '#1C1C28' : '#F0F0F8') : theme.primaryMuted }]}>
                  {ti ? <Text style={{ fontSize: 17, opacity: done ? 0.4 : 1 }}>{ti}</Text>
                      : <View style={[s.taskDotInner, { backgroundColor: done ? (isDark ? '#3A3A50' : '#CCCCDD') : theme.primary }]} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                  <Text style={[s.taskCardTitle, done && s.taskCardTitleDone]} numberOfLines={1}>{inst.task?.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 }}>
                    {!done && (
                      <View style={[s.tagPillOutline, { borderColor: theme.primaryBorder }]}>
                        <Text style={[s.tagPillOutlineText, { color: theme.textSecondary }]}>{tag || 'Untagged'}</Text>
                      </View>
                    )}
                    {isOneTime && inst.task?.deadline && !done && (
                      <Text style={s.deadlineLabel}>
                        Due {new Date(inst.task.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                    {overdueColor && !done && !missed && (
                      <TouchableOpacity onPress={() => toast.warning('Overdue', overdueLabel)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 11, color: overdueColor, fontWeight: '700' }}>Overdue</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {inst.status === 'pending' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[s.doneBtn, { backgroundColor: theme.primary }]}
                      onPress={() => handleComplete(inst.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.skipBtn} onPress={() => openSkipFlow(inst.id)}>
                      <Ionicons name="close" size={13} color={isDark ? '#44445A' : '#AAAABC'} />
                    </TouchableOpacity>
                  </View>
                )}
                {done && (
                  <View style={s.statusDoneChip}>
                    <Ionicons name="checkmark-circle" size={18} color={isDark ? '#3A3A50' : '#CCCCDD'} />
                  </View>
                )}
                {missed && <Text style={s.statusMissed}>Missed</Text>}
                {snoozed && <Text style={s.statusSnoozed}>Snoozed</Text>}
              </TouchableOpacity>
            );

            if (isOneTime) {
              return (
                <Swipeable
                  key={inst.id}
                  renderRightActions={() => (
                    <RectButton
                      style={{ backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 75, borderRadius: 16, marginLeft: 8 }}
                      onPress={() => handleDeleteOneTimeTask(inst.task_id, inst.task?.title || 'Task', inst.task?.created_at)}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Delete</Text>
                    </RectButton>
                  )}
                  overshootRight={false}
                >
                  {taskCardContent}
                </Swipeable>
              );
            }

            return <View key={inst.id}>{taskCardContent}</View>;
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ===== Challenge Log Modal ===== */}
      <Modal visible={logModalVisible} transparent animationType="slide" onRequestClose={() => setLogModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Log Progress</Text>
              {logModalTask && (
                <>
                  <Text style={s.modalSubtitle}>{logModalTask.title}</Text>
                  {challengeStatsMap[logModalTask.id] && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${Math.min(challengeStatsMap[logModalTask.id].percentage, 100)}%`, backgroundColor: theme.primary }]} />
                      </View>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 6, textAlign: 'center' }}>
                        {challengeStatsMap[logModalTask.id].currentProgress}/{challengeStatsMap[logModalTask.id].targetAmount} {challengeStatsMap[logModalTask.id].targetUnit} ({challengeStatsMap[logModalTask.id].percentage}%)
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4, textAlign: 'center' }}>
                        Today's target: {challengeStatsMap[logModalTask.id].dailyTarget} {challengeStatsMap[logModalTask.id].targetUnit}
                      </Text>
                    </View>
                  )}
                  <Text style={s.modalLabel}>How many {logModalTask.target_unit || 'units'} did you complete?</Text>
                  <TextInput
                    style={s.modalInput}
                    placeholder={`e.g. ${challengeStatsMap[logModalTask.id]?.dailyTarget || 10}`}
                    placeholderTextColor={theme.textTertiary}
                    value={logAmount}
                    onChangeText={setLogAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                </>
              )}
              <View style={s.modalButtons}>
                <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={() => setLogModalVisible(false)}>
                  <Text style={[s.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={handleChallengeLog} disabled={logLoading}>
                  <Text style={[s.modalBtnText, { color: '#fff' }]}>{logLoading ? 'Saving...' : 'Log Progress'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={skipVisible} transparent animationType="fade" onRequestClose={closeSkipFlow}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Skip Task</Text>
              <Text style={s.modalSubtitle}>Why are you skipping this task?</Text>

              <TextInput
                style={s.modalInput}
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
                style={[s.modalInput, { marginTop: 8 }]}
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

              <View style={s.modalButtons}>
                <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={closeSkipFlow} disabled={skipSaving}>
                  <Text style={[s.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={submitSkipFlow} disabled={skipSaving}>
                  <Text style={[s.modalBtnText, { color: '#fff' }]}>{skipSaving ? 'Saving...' : 'Save skip'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Challenge Outcome Modal ===== */}
      <Modal visible={outcomeModalVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.outcomeOverlay}>
            <View style={s.outcomeContent}>
            {currentOutcome && (
              <>
                {/* Header with Nyla */}
                <View style={s.outcomeHeader}>
                  <Image source={ICONS.nyla} style={s.outcomeNyla} resizeMode="contain" />
                  <View style={[
                    s.outcomeBadge,
                    currentOutcome.outcome === 'completed' ? s.outcomeBadgeSuccess : s.outcomeBadgeFail,
                  ]}>
                    <Text style={s.outcomeBadgeText}>
                      {currentOutcome.outcome === 'completed' ? '🎉 Challenge Complete' : '⏱ Challenge Ended'}
                    </Text>
                  </View>
                </View>

                {/* Challenge title */}
                <Text style={s.outcomeTitle}>{currentOutcome.title}</Text>

                {/* Progress ring visual */}
                <View style={s.outcomeProgressRow}>
                  <View style={[
                    s.outcomeProgressCircle,
                    currentOutcome.outcome === 'completed' ? { borderColor: theme.success } : { borderColor: theme.error },
                  ]}>
                    <Text style={[
                      s.outcomeProgressPct,
                      currentOutcome.outcome === 'completed' ? { color: theme.success } : { color: theme.error },
                    ]}>
                      {currentOutcome.percentage}%
                    </Text>
                  </View>
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text style={s.outcomeStatLabel}>Achieved</Text>
                    <Text style={s.outcomeStatValue}>
                      {currentOutcome.currentProgress} / {currentOutcome.targetAmount} {currentOutcome.targetUnit}
                    </Text>
                  </View>
                </View>

                {/* Nyla's message */}
                <View style={s.outcomeNylaMsg}>
                  <Text style={s.outcomeNylaMsgText}>
                    {getNylaOutcomeMessage(currentOutcome)}
                  </Text>
                </View>

                {/* Mood selector */}
                <Text style={s.outcomeSectionLabel}>How do you feel?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {outcomeMoods.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          s.outcomeMoodPill,
                          outcomeMood === m.key && s.outcomeMoodPillActive,
                        ]}
                        onPress={() => setOutcomeMood(m.key)}
                      >
                        <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                        <Text style={[
                          s.outcomeMoodLabel,
                          outcomeMood === m.key && { color: theme.primary },
                        ]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Reflection input */}
                <Text style={s.outcomeSectionLabel}>
                  {currentOutcome.outcome === 'failed'
                    ? 'Reflect on what happened *'
                    : 'What helped you succeed? (optional)'}
                </Text>
                <TextInput
                  style={s.outcomeTextInput}
                  placeholder={currentOutcome.outcome === 'failed'
                    ? 'What got in the way? What would you do differently?'
                    : 'Share what worked — it helps Nyla learn about you...'}
                  placeholderTextColor={theme.textTertiary}
                  value={outcomeReflection}
                  onChangeText={setOutcomeReflection}
                  multiline
                  numberOfLines={3}
                />

                {/* Save button */}
                <TouchableOpacity
                  style={[
                    s.outcomeSaveBtn,
                    currentOutcome.outcome === 'completed' ? { backgroundColor: theme.success } : { backgroundColor: theme.primary },
                    outcomeSaving && { opacity: 0.6 },
                  ]}
                  onPress={handleSaveOutcomeReflection}
                  disabled={outcomeSaving}
                >
                  <Text style={s.outcomeSaveBtnText}>
                    {outcomeSaving
                      ? 'Saving...'
                      : currentOutcome.outcome === 'completed'
                        ? '🎉 Close & Celebrate'
                        : 'Submit Reflection'}
                  </Text>
                </TouchableOpacity>

                {currentOutcome.outcome === 'completed' && (
                  <TouchableOpacity
                    style={[s.outcomeSaveBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary, marginTop: 10 }]}
                    onPress={() => {
                      const target = currentOutcome.targetAmount || 0;
                      const progress = currentOutcome.currentProgress || 0;
                      const remaining = Math.max(0, target - progress);
                      const deadlineRaw = (currentOutcome as any).deadline;
                      const deadlineDate = deadlineRaw ? new Date(deadlineRaw) : null;
                      const daysLeft = deadlineDate ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)) : 0;
                      const daysEstimate = Math.max(1, Math.ceil((Date.now() - new Date((currentOutcome as any).created_at || Date.now()).getTime()) / 86400000));
                      const dailyTarget = daysLeft > 0 ? remaining / daysLeft : remaining;
                      const outcomeTag = (currentOutcome as any).tags?.[0] || null;
                      const outcomeTagIcon = outcomeTag ? ((TAG_ICONS as any)[outcomeTag] || null) : null;
                      const deadlineStr = deadlineDate
                        ? deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : null;
                      setShareData({
                        type: 'challenge',
                        challengeName: currentOutcome.title,
                        targetAmount: target,
                        targetUnit: currentOutcome.targetUnit || 'units',
                        currentProgress: progress,
                        durationDays: daysEstimate,
                        dailyAverage: target > 0 ? parseFloat((progress / daysEstimate).toFixed(1)) : 0,
                        daysLeft,
                        dailyTarget: parseFloat(dailyTarget.toFixed(1)),
                        remaining,
                        deadline: deadlineStr,
                        tag: outcomeTag,
                        tagIcon: outcomeTagIcon,
                      });
                      setShareVisible(true);
                    }}
                  >
                    <Text style={[s.outcomeSaveBtnText, { color: theme.primary }]}>Share Achievement</Text>
                  </TouchableOpacity>
                )}

                {challengeOutcomes.length > 1 && (
                  <Text style={s.outcomeCounter}>
                    {currentOutcomeIdx + 1} of {challengeOutcomes.length} challenges
                  </Text>
                )}
              </>
            )}
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


      {/* ===== NYLA TASK REVIEW MODAL ===== */}
      <Modal visible={parsedReviewVisible} transparent animationType="slide" onRequestClose={() => setParsedReviewVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={[s.modalContent, { maxHeight: '85%' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Image source={ICONS.nyla} style={{ width: 36, height: 36, backgroundColor: 'transparent' }} resizeMode="contain" />
                <Text style={s.modalTitle}>Review Tasks</Text>
              </View>
              <Text style={[s.modalSubtitle, { marginBottom: 20 }]}>Nyla found {parsedTasksReview.length} task{parsedTasksReview.length !== 1 ? 's' : ''}. Edit or confirm before saving.</Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {parsedTasksReview.map((task, idx) => (
                  <View key={idx} style={[s.taskCard, { marginBottom: 12, flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={[s.taskAccentBar, { backgroundColor: theme.primary, height: 40 }]} />
                      <TextInput
                        style={[s.aiTextInput, { flex: 1, minHeight: 40, marginBottom: 0, marginLeft: 8 }]}
                        value={task.title}
                        onChangeText={(text) => {
                          const updated = [...parsedTasksReview];
                          updated[idx] = { ...updated[idx], title: text };
                          setParsedTasksReview(updated);
                        }}
                        placeholderTextColor={theme.textTertiary}
                      />
                      <TouchableOpacity
                        onPress={() => setParsedTasksReview(parsedTasksReview.filter((_, i) => i !== idx))}
                        style={{ padding: 8 }}
                      >
                        <Ionicons name="close" size={16} color={isDark ? '#44445A' : '#AAAABC'} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingLeft: 12 }}>
                      <View style={[s.tagPillOutline, { borderColor: theme.primary + '40', backgroundColor: theme.primary + '12' }]}>
                        <Text style={[s.tagPillOutlineText, { color: theme.primary }]}>
                          {task.task_type === 'one_time' ? 'One-time' : task.task_type === 'recurring' ? 'Recurring' : 'Challenge'}
                        </Text>
                      </View>
                      {task.tags?.[0] && (
                        <View style={[s.tagPillOutline, { borderColor: theme.textTertiary + '40' }]}>
                          <Text style={[s.tagPillOutlineText, { color: theme.textSecondary }]}>{task.tags[0]}</Text>
                        </View>
                      )}
                      {task.time_block && (
                        <View style={[s.tagPillOutline, { borderColor: theme.textTertiary + '30' }]}>
                          <Text style={[s.tagPillOutlineText, { color: theme.textTertiary }]}>{task.time_block}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              {parsedTasksReview.length === 0 ? (
                <TouchableOpacity
                  style={[s.modalBtn, s.modalBtnSecondary, { marginTop: 16 }]}
                  onPress={() => setParsedReviewVisible(false)}
                >
                  <Text style={[s.modalBtnText, { color: theme.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.modalButtons, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[s.modalBtn, s.modalBtnSecondary]}
                    onPress={() => setParsedReviewVisible(false)}
                  >
                    <Text style={[s.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtn, s.modalBtnPrimary, parsedSaving && { opacity: 0.6 }]}
                    onPress={saveParsedTasks}
                    disabled={parsedSaving}
                  >
                    {parsedSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={[s.modalBtnText, { color: '#fff' }]}>Save {parsedTasksReview.length > 1 ? 'All' : 'Task'}</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
      <NylaFocusOverlay
        visible={focusVisible}
        loading={focusLoading}
        message={focusData?.message || null}
        onDismiss={dismissFocus}
        isDark={isDark}
        theme={theme}
      />
    </View>
  );
}



const makeStyles = (t: any, isDark: boolean) => StyleSheet.create({

  // ─── CONTAINER ────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0A0A10' : '#F2F2F7',
  },

  // ─── HERO HEADER ──────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: isDark ? '#0A0A10' : '#F2F2F7',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerDate: {
    fontSize: 13,
    fontWeight: '500',
    color: t.textTertiary,
    letterSpacing: 0.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: t.textPrimary,
    letterSpacing: -1,
    lineHeight: 36,
  },
  headerName: {
    fontSize: 32,
    fontWeight: '800',
    color: t.primary,
    letterSpacing: -1,
    lineHeight: 36,
  },
  headerDot: {
    fontSize: 28,
    color: t.textTertiary,
    fontWeight: '300',
  },
  headerTaskCount: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textTertiary,
    marginLeft: 10,
    paddingTop: 2,
  },

  // ─── PROGRESS BAR ─────────────────────────────────────────────────────────
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarTrackWrap: {
    flex: 1,
    height: 4,
    backgroundColor: isDark ? '#1E1E2E' : '#E0E0EC',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFillWrap: {
    height: '100%',
    backgroundColor: t.primary,
    borderRadius: 2,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: t.textPrimary,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 14,
    color: t.textTertiary,
    marginTop: 3,
  },
  greetingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? '#18181F' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E4E4EC',
  },
  greetingIcon: {
    width: 20,
    height: 20,
    tintColor: t.primary,
    resizeMode: 'contain',
  },

  // ─── MOMENTUM CARD ────────────────────────────────────────────────────────
  momentumCard: {
    marginHorizontal: 20,
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  momentumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  momentumIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: t.textTertiary,
  },
  momentumTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: isDark ? '#1A1A28' : '#F2F2FA',
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 56,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 16,
    height: 36,
    backgroundColor: isDark ? '#1C1C2C' : '#EBEBF4',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 3,
  },
  barLabel: {
    fontSize: 9,
    color: t.textTertiary,
    marginTop: 5,
    fontWeight: '500',
  },

  // ─── SECTIONS ─────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textTertiary,
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ─── PRIORITY CARD ────────────────────────────────────────────────────────
  priorityCard: {
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingRight: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
    overflow: 'hidden',
  },
  priorityIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityIconInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityIconEmoji: {
    fontSize: 20,
  },
  priorityTextBlock: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  priorityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: t.textPrimary,
    letterSpacing: -0.3,
  },
  priorityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  priorityMeta: {
    fontSize: 12,
    color: t.textTertiary,
  },
  priorityMetaDot: {
    fontSize: 12,
    color: t.textTertiary,
  },
  priorityDoneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityDoneBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  priorityActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ─── TAG PILLS ────────────────────────────────────────────────────────────
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagPillOutline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  tagPillOutlineText: {
    fontSize: 11,
    fontWeight: '500',
  },
  deadlineLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: t.textTertiary,
  },

  // ─── TASK CARD ────────────────────────────────────────────────────────────
  taskCard: {
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
    overflow: 'hidden',
  },
  taskCardDone: {
    opacity: 0.5,
  },
  taskAccentBar: {
    width: 3,
    height: '100%',
    borderRadius: 0,
    marginRight: 12,
    minHeight: 44,
  },
  taskIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  taskCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: t.textPrimary,
    letterSpacing: -0.2,
  },
  taskCardTitleDone: {
    textDecorationLine: 'line-through',
    color: t.textTertiary,
  },
  taskCardMeta: {
    fontSize: 12,
    color: t.textTertiary,
    marginTop: 3,
  },

  // ─── DONE / SKIP ──────────────────────────────────────────────────────────
  doneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  skipBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#1A1A28' : '#F0F0F8',
  },
  skipBtnText: {
    color: t.textTertiary,
    fontSize: 12,
  },
  skipReasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  skipReasonChip: {
    backgroundColor: t.primaryMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.primaryBorder,
    paddingHorizontal: 12,
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
    marginBottom: 10,
  },
  skipActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E4E4F0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: isDark ? '#13131C' : '#FAFAFA',
  },
  skipActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
  reviewDateBtn: {
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E4E4F0',
    borderRadius: 14,
    backgroundColor: isDark ? '#13131C' : '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  reviewDateLabel: {
    fontSize: 11,
    color: t.textTertiary,
    marginBottom: 3,
  },
  reviewDateValue: {
    fontSize: 14,
    color: t.textPrimary,
    fontWeight: '700',
  },

  // ─── STATUS ───────────────────────────────────────────────────────────────
  statusDone: {
    fontSize: 12,
    color: t.success,
    fontWeight: '700',
  },
  statusDoneChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#1A1A28' : '#F0F0F8',
  },
  statusMissed: {
    fontSize: 11,
    color: t.error,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: t.errorMuted,
    overflow: 'hidden',
  },
  statusSnoozed: {
    fontSize: 11,
    color: t.warning,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: t.warningMuted,
    overflow: 'hidden',
  },

  // ─── TASK LIST HEADER ─────────────────────────────────────────────────────
  taskListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskListCount: {
    fontSize: 12,
    color: t.primary,
    fontWeight: '700',
    backgroundColor: t.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // ─── EMPTY STATE ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.textTertiary,
    marginBottom: 20,
  },
  emptyStateBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: t.primary,
  },
  emptyStateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // ─── PROGRESS (challenges) ────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    backgroundColor: isDark ? '#1E1E2E' : '#EBEBF4',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: t.textTertiary,
    fontWeight: '500',
  },

  // ─── INPUT TABS ───────────────────────────────────────────────────────────
  inputTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 0,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  inputTab: {
    paddingBottom: 12,
    alignItems: 'center',
  },
  inputTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputTabIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  inputTabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: t.textTertiary,
  },
  inputTabLabelActive: {
    color: t.textPrimary,
    fontWeight: '700',
  },
  inputTabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: t.primary,
    borderRadius: 1,
  },

  // ─── INPUT CARD ───────────────────────────────────────────────────────────
  inputCard: {
    marginHorizontal: 20,
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  inputCardContent: {
    alignItems: 'center',
    marginTop: 16,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 16,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: t.textTertiary,
  },
  subTabTextActive: {
    color: t.textPrimary,
    fontWeight: '700',
  },

  // ─── VOICE / MIC ──────────────────────────────────────────────────────────
  micContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pulseRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIconImg: {
    width: 34,
    height: 34,
  },
  voiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: t.textPrimary,
    marginBottom: 4,
  },
  voiceSub: {
    fontSize: 13,
    color: t.textTertiary,
    lineHeight: 20,
    textAlign: 'center',
  },
  aiTextInput: {
    backgroundColor: isDark ? '#0D0D14' : '#F7F7FC',
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#E4E4EC',
    minHeight: 52,
    textAlignVertical: 'top',
    width: '100%',
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: t.primary,
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E0E0EC',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── SUGGESTION CARD ──────────────────────────────────────────────────────
  suggestionCard: {
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  suggestionAddBtn: {
    backgroundColor: t.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  suggestionAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── MODAL ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 20,
    fontWeight: '500',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: isDark ? '#0D0D14' : '#F7F7FC',
    borderRadius: 16,
    padding: 16,
    fontSize: 20,
    fontWeight: '700',
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#E4E4EC',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E0E0EC',
  },
  modalBtnPrimary: {
    backgroundColor: t.primary,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── AI ERROR ─────────────────────────────────────────────────────────────
  aiErrorBanner: {
    marginHorizontal: 0,
    marginTop: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  aiErrorBannerLimit: {
    backgroundColor: isDark ? '#1C1508' : '#FFFBEB',
    borderColor: isDark ? '#5C3D00' : '#FDE68A',
  },
  aiErrorBannerGeneric: {
    backgroundColor: isDark ? '#1C0808' : '#FEF2F2',
    borderColor: isDark ? '#5C1414' : '#FECACA',
  },
  aiErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiErrorMessage: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 19,
  },
  aiErrorRetryBtn: {
    backgroundColor: t.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },
  aiErrorRetryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  aiErrorDismissText: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
  },

  // ─── OUTCOME MODAL ────────────────────────────────────────────────────────
  outcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  outcomeContent: {
    backgroundColor: isDark ? '#13131C' : '#FFFFFF',
    borderRadius: 32,
    padding: 26,
    width: '100%',
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#EAEAF4',
  },
  outcomeHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  outcomeNyla: {
    width: 60,
    height: 60,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  outcomeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  outcomeBadgeSuccess: {
    backgroundColor: isDark ? '#052E1A' : '#D1FAE5',
  },
  outcomeBadgeFail: {
    backgroundColor: isDark ? '#2C1500' : '#FEF3C7',
  },
  outcomeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textPrimary,
  },
  outcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: t.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  outcomeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  outcomeProgressCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#1A1A24' : '#F5F5FA',
  },
  outcomeProgressPct: {
    fontSize: 18,
    fontWeight: '800',
  },
  outcomeStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: t.textTertiary,
    marginBottom: 2,
  },
  outcomeStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: t.textPrimary,
  },
  outcomeNylaMsg: {
    backgroundColor: isDark ? '#12101E' : '#F4F0FF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: t.primary,
  },
  outcomeNylaMsgText: {
    fontSize: 14,
    color: t.textPrimary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  outcomeSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textTertiary,
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  outcomeMoodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? '#1A1A24' : '#F5F5FA',
    borderWidth: 1,
    borderColor: isDark ? '#2A2A38' : '#E4E4F0',
  },
  outcomeMoodPillActive: {
    borderColor: t.primary,
    backgroundColor: t.primaryMuted,
  },
  outcomeMoodLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textTertiary,
  },
  outcomeTextInput: {
    backgroundColor: isDark ? '#0D0D14' : '#F7F7FC',
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: isDark ? '#1E1E2E' : '#E4E4EC',
    textAlignVertical: 'top',
    minHeight: 84,
    marginBottom: 20,
  },
  outcomeSaveBtn: {
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
  },
  outcomeSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  outcomeCounter: {
    fontSize: 12,
    color: t.textTertiary,
    textAlign: 'center',
    marginTop: 14,
  },

});