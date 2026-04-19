import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const NYLA_AVATAR = require('../../assets/icons/nyla-avatar.png');
const SHARE_ICON = require('../../assets/icons/share-icon.png');
import { supabase } from '../../lib/supabase';
import {
  getCompletionRate,
  getNeglectedAreas,
  getPeakTimeOfDay,
  getStreak,
  getTagBreakdown,
  loadCurrentReflection,
  loadPastReflections,
  saveReflection,
  loadWeeklyInsights,
  saveWeeklyInsights,
} from '../../lib/analytics';
import { getChallengeReflections } from '../../lib/tasks';
import {
  BehaviouralMirror,
  generateBehaviouralMirror,
  generateStructuredReflection,
  StructuredReflection,
  AIRateLimitError,
  AIUnavailableError,
} from '../../lib/ai';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../components/Toast';
import { useProfile } from '../../lib/ProfileContext';
import { Ionicons } from '@expo/vector-icons';
import ShareModal from '../../components/sharing/ShareModal';
import { ShareData } from '../../components/sharing/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function InsightsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { profile: cachedProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Neglected Areas
  const [neglected, setNeglected] = useState<any[]>([]);

  // Behavioural Mirror
  const [mirror, setMirror] = useState<BehaviouralMirror | null>(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorTab, setMirrorTab] = useState<'strengths' | 'blindSpots'>('strengths');
  const [mirrorError, setMirrorError] = useState<{ type: 'rate_limit' | 'unavailable' | 'generic'; message: string } | null>(null);

  // Weekly Reflection
  const [structuredReflection, setStructuredReflection] = useState<StructuredReflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState<{ type: 'rate_limit' | 'unavailable' | 'generic'; message: string } | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionSaved, setReflectionSaved] = useState(false);

  // Past reflections
  const [pastReflections, setPastReflections] = useState<any[]>([]);
  const [showPastReflections, setShowPastReflections] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  const openShare = (data: ShareData) => {
    setShareData(data);
    setShareVisible(true);
  };

  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async (forceRegenerate = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const days = 30;
      const [na, currentRefl, pastRefl, cachedInsights] = await Promise.all([
        getNeglectedAreas(user.id, days, cachedProfile?.app_mode ?? undefined, cachedProfile?.focus_tags ?? undefined),
        loadCurrentReflection(user.id),
        loadPastReflections(user.id, 8),
        loadWeeklyInsights(user.id),
      ]);

      if (cachedProfile?.display_name) setDisplayName(cachedProfile.display_name);
      setNeglected(na);

      // Load current user reflection if exists
      if (currentRefl) {
        setReflectionText(currentRefl.reflection_text || '');
        setSelectedMood(currentRefl.mood || null);
        setReflectionSaved(true);
      }

      const currentWeekStart = currentRefl?.week_start;
      setPastReflections(
        (pastRefl || []).filter((r: any) => r.week_start !== currentWeekStart)
      );

      // Check if we have cached AI insights for this week
      if (cachedInsights && !forceRegenerate) {
        // Use cached data — no API calls
        if (cachedInsights.mirror_data) {
          setMirror(cachedInsights.mirror_data as BehaviouralMirror);
        }
        if (cachedInsights.reflection_data) {
          setStructuredReflection(cachedInsights.reflection_data as StructuredReflection);
        }
      } else {
        // No cache for this week (or forced regeneration) — generate fresh AI insights
        const [tb, pt, cr, streakVal, challengeRefls] = await Promise.all([
          getTagBreakdown(user.id, days),
          getPeakTimeOfDay(user.id, days),
          getCompletionRate(user.id, days),
          getStreak(user.id),
          getChallengeReflections(user.id, 5),
        ]);

        if (cr.started === 0) return;

        const topTags = (tb || [])
          .filter((t: any) => t.total > 0)
          .slice(0, 3)
          .map((t: any) => ({ tag: t.tag, rate: t.rate }));
        const neglectedTags = (na || []).map((n: any) => n.tag);

        const challengeSummary = (challengeRefls || []).map((r: any) => ({
          title: r.task?.title || 'Challenge',
          outcome: r.outcome,
          achieved: r.achieved_amount,
          target: r.target_amount,
          reflection: r.reflection_text,
          mood: r.mood,
        }));

        const aiContext = {
          completionRate: cr.rate,
          totalTasks: cr.started,
          completedTasks: cr.done,
          missedTasks: cr.missed,
          topTags,
          neglectedTags,
          streak: streakVal,
          peakTime: pt?.peak || 'Morning',
          reflectionText: currentRefl?.reflection_text || undefined,
          mood: currentRefl?.mood || undefined,
          challengeReflections: challengeSummary.length > 0 ? challengeSummary : undefined,
        };

        let newMirror: BehaviouralMirror | null = null;
        let newReflection: StructuredReflection | null = null;

        // Generate Behavioural Mirror
        setMirrorLoading(true);
        setMirrorError(null);
        try {
          newMirror = await generateBehaviouralMirror(aiContext, cachedProfile);
          setMirror(newMirror);
        } catch (e: any) {
          console.log('Behavioural mirror unavailable:', e.message);
          setMirror(null);
          if (e instanceof AIRateLimitError) {
            setMirrorError({ type: 'rate_limit', message: 'Daily AI limit reached. Try again tomorrow.' });
          } else if (e instanceof AIUnavailableError) {
            setMirrorError({ type: 'unavailable', message: 'Nyla is taking longer than usual. Tap Retry in a moment.' });
          } else {
            setMirrorError({ type: 'generic', message: 'Could not generate behavioural mirror.' });
          }
        } finally {
          setMirrorLoading(false);
        }

        // Generate Structured Reflection
        setReflectionLoading(true);
        setReflectionError(null);
        try {
          newReflection = await generateStructuredReflection(aiContext, cachedProfile);
          setStructuredReflection(newReflection);
        } catch (e: any) {
          console.log('Structured reflection unavailable:', e.message);
          setStructuredReflection(null);
          if (e instanceof AIRateLimitError) {
            setReflectionError({ type: 'rate_limit', message: 'Daily AI limit reached. Try again tomorrow.' });
          } else if (e instanceof AIUnavailableError) {
            setReflectionError({ type: 'unavailable', message: 'Nyla is taking longer than usual. Tap Retry in a moment.' });
          } else {
            setReflectionError({ type: 'generic', message: 'Could not generate weekly reflection.' });
          }
        } finally {
          setReflectionLoading(false);
        }

        // Cache the results for this week (even if one failed)
        if (newMirror || newReflection) {
          try {
            await saveWeeklyInsights(user.id, newMirror, newReflection);
          } catch (e: any) {
            console.error('Failed to cache weekly insights:', e.message);
          }
        }
      }
    } catch (e: any) {
      console.error('Insights error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveReflection = async () => {
    if (!reflectionText.trim() && !selectedMood) {
      toast.warning('Nothing here', 'Write a reflection or select a mood first.');
      return;
    }
    setSavingReflection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await saveReflection(user.id, reflectionText.trim(), selectedMood);
      setReflectionSaved(true);
      toast.success('Saved', 'Your weekly reflection has been saved.');
    } catch (e: any) {
      console.error('Save reflection error:', e.message);
      toast.error('Oops', 'Could not save reflection. Please try again.');
    } finally {
      setSavingReflection(false);
    }
  };

  const moods = [
    { key: 'great', label: 'Great', emoji: '😊' },
    { key: 'good', label: 'Good', emoji: '🙂' },
    { key: 'just_there', label: 'Just there', emoji: '😐' },
    { key: 'bad', label: 'Bad', emoji: '😞' },
  ];

  const handleMirrorSwipe = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const { translationX, velocityX } = nativeEvent;
      if (Math.abs(translationX) > 40 || Math.abs(velocityX) > 300) {
        if (translationX < 0 && mirrorTab === 'strengths') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setMirrorTab('blindSpots');
        } else if (translationX > 0 && mirrorTab === 'blindSpots') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setMirrorTab('strengths');
        }
      }
    }
  };

  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Insights</Text>
        </View>

        {loading && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {!loading && (
          <>
            {/* ===== NEGLECTED AREAS ===== */}
            <View style={s.sectionPadded}>
              <Text style={s.sectionTitle}>Neglected Areas</Text>
              <Text style={s.sectionSub}>
                Areas that received little or no attention this week.
              </Text>
              {neglected.length === 0 && (
                <View style={s.neglectedEmpty}>
                  <Text style={s.neglectedEmptyText}>All areas are covered! Great work.</Text>
                </View>
              )}
              {neglected.map((item, i) => (
                <View key={i} style={s.neglectedCard}>
                  <View style={[s.neglectedIcon, { backgroundColor: item.color + '20' }]}>
                    <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.neglectedTitle}>{item.tag}</Text>
                    <Text style={s.neglectedDesc}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ===== NYLA'S MIRROR ===== */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={NYLA_AVATAR} style={{ width: 28, height: 28, backgroundColor: 'transparent' }} resizeMode="contain" />
                <Text style={[s.sectionTitle, { flex: 1 }]}>Nyla's Mirror</Text>
                {mirror && (
                  <TouchableOpacity
                    hitSlop={10}
                    onPress={() => openShare({
                      type: 'nyla_mirror',
                      title: mirror.title,
                      strengths: mirror.strengths,
                      blindSpots: mirror.blindSpots,
                    })}
                  >
                    <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: theme.textSecondary }} />
                  </TouchableOpacity>
                )}
              </View>

              {mirrorLoading && (
                <View style={s.aiLoadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={s.aiLoadingText}>Nyla is analysing your behaviour...</Text>
                </View>
              )}

              {!mirrorLoading && mirror && (
                <>
                  {/* Title badge */}
                  <View style={s.mirrorTitleBadge}>
                    <Text style={s.mirrorTitleText}>{mirror.title}</Text>
                  </View>

                  {/* Tab switcher */}
                  <View style={s.mirrorTabs}>
                    <TouchableOpacity
                      style={[s.mirrorTab, mirrorTab === 'strengths' && s.mirrorTabActive]}
                      onPress={() => setMirrorTab('strengths')}
                    >
                      <Text style={[s.mirrorTabText, mirrorTab === 'strengths' && s.mirrorTabTextActive]}>
                        Strengths
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.mirrorTab, mirrorTab === 'blindSpots' && s.mirrorTabActive]}
                      onPress={() => setMirrorTab('blindSpots')}
                    >
                      <Text style={[s.mirrorTabText, mirrorTab === 'blindSpots' && s.mirrorTabTextActive]}>
                        Blind Spots
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Content — swipeable */}
                  <PanGestureHandler onHandlerStateChange={handleMirrorSwipe} activeOffsetX={[-20, 20]}>
                    <View>
                      {mirrorTab === 'strengths' && (
                        <View style={s.mirrorContent}>
                          {mirror.strengths.length === 0 ? (
                            <Text style={s.mirrorItem}>Keep logging tasks to unlock your strength insights.</Text>
                          ) : (
                            mirror.strengths.map((s_item, i) => (
                              <View key={i} style={s.mirrorItemRow}>
                                <View style={[s.mirrorDot, { backgroundColor: theme.success }]} />
                                <Text style={s.mirrorItem}>{s_item}</Text>
                              </View>
                            ))
                          )}
                        </View>
                      )}

                      {mirrorTab === 'blindSpots' && (
                        <View style={s.mirrorContent}>
                          {mirror.blindSpots.length === 0 ? (
                            <View style={s.mirrorEmptySpots}>
                              <Text style={s.mirrorEmptySpotsText}>
                                No blind spots detected this week. You're doing well across the board!
                              </Text>
                            </View>
                          ) : (
                            mirror.blindSpots.map((b_item, i) => (
                              <View key={i} style={s.mirrorItemRow}>
                                <View style={[s.mirrorDot, { backgroundColor: theme.warning }]} />
                                <Text style={s.mirrorItem}>{b_item}</Text>
                              </View>
                            ))
                          )}
                        </View>
                      )}

                      {/* Tab indicator dots */}
                      <View style={s.mirrorDots}>
                        <View style={[s.indicatorDot, mirrorTab === 'strengths' && s.indicatorDotActive]} />
                        <View style={[s.indicatorDot, mirrorTab === 'blindSpots' && s.indicatorDotActive]} />
                      </View>
                    </View>
                  </PanGestureHandler>
                </>
              )}

              {!mirrorLoading && !mirror && !mirrorError && (
                <Text style={s.mirrorPlaceholder}>
                  Log more tasks this week so Nyla can unlock your behavioural mirror.
                </Text>
              )}

              {!mirrorLoading && mirrorError && (
                <View style={[s.aiErrorCard, mirrorError.type === 'rate_limit' ? s.aiErrorCardLimit : s.aiErrorCardGeneric]}>
                  <Image source={NYLA_AVATAR} style={{ width: 28, height: 28, backgroundColor: 'transparent' }} resizeMode="contain" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.aiErrorCardTitle, mirrorError.type === 'rate_limit' ? { color: '#F59E0B' } : { color: '#EF4444' }]}>
                      {mirrorError.type === 'rate_limit' ? 'Daily Limit Reached' : 'Nyla is Unavailable'}
                    </Text>
                    <Text style={s.aiErrorCardMsg}>{mirrorError.message}</Text>
                  </View>
                  {mirrorError.type !== 'rate_limit' && (
                    <TouchableOpacity onPress={() => loadData(true)} style={s.aiErrorRetryBtn}>
                      <Text style={s.aiErrorRetryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* ===== WEEKLY REFLECTIONS ===== */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={NYLA_AVATAR} style={{ width: 28, height: 28, backgroundColor: 'transparent' }} resizeMode="contain" />
                <Text style={[s.sectionTitle, { flex: 1 }]}>Nyla's Reflection</Text>
                {structuredReflection && (
                  <TouchableOpacity
                    hitSlop={10}
                    onPress={() => openShare({
                      type: 'nyla_mirror',
                      title: 'Weekly Reflection',
                      strengths: [structuredReflection.strengths, structuredReflection.focusNextWeek],
                      blindSpots: [structuredReflection.struggles, structuredReflection.emotionalPattern],
                    })}
                  >
                    <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: theme.textSecondary }} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Nyla's Reflection */}
              {reflectionLoading && (
                <View style={s.aiLoadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={s.aiLoadingText}>Nyla is preparing your reflection...</Text>
                </View>
              )}

              {!reflectionLoading && structuredReflection && (
                <View style={s.reflectionSections}>
                  <View style={s.reflectionBlock}>
                    <Text style={[s.reflectionLabel, { color: theme.success }]}>Strengths this week</Text>
                    <Text style={s.reflectionText}>{structuredReflection.strengths}</Text>
                  </View>
                  <View style={s.reflectionBlock}>
                    <Text style={[s.reflectionLabel, { color: theme.error }]}>Struggles</Text>
                    <Text style={s.reflectionText}>{structuredReflection.struggles}</Text>
                  </View>
                  <View style={s.reflectionBlock}>
                    <Text style={[s.reflectionLabel, { color: theme.warning }]}>Emotional pattern</Text>
                    <Text style={s.reflectionText}>{structuredReflection.emotionalPattern}</Text>
                  </View>
                  <View style={s.reflectionBlock}>
                    <Text style={[s.reflectionLabel, { color: theme.primary }]}>Focus for next week</Text>
                    <Text style={s.reflectionText}>{structuredReflection.focusNextWeek}</Text>
                  </View>
                </View>
              )}

              {!reflectionLoading && !structuredReflection && !reflectionError && (
                <Text style={s.reflectionPlaceholder}>
                  Log more tasks this week to get a personalized reflection.
                </Text>
              )}

              {!reflectionLoading && reflectionError && (
                <View style={[s.aiErrorCard, reflectionError.type === 'rate_limit' ? s.aiErrorCardLimit : s.aiErrorCardGeneric]}>
                  <Image source={NYLA_AVATAR} style={{ width: 28, height: 28, backgroundColor: 'transparent' }} resizeMode="contain" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.aiErrorCardTitle, reflectionError.type === 'rate_limit' ? { color: '#F59E0B' } : { color: '#EF4444' }]}>
                      {reflectionError.type === 'rate_limit' ? 'Daily Limit Reached' : 'Nyla is Unavailable'}
                    </Text>
                    <Text style={s.aiErrorCardMsg}>{reflectionError.message}</Text>
                  </View>
                  {reflectionError.type !== 'rate_limit' && (
                    <TouchableOpacity onPress={() => loadData(true)} style={s.aiErrorRetryBtn}>
                      <Text style={s.aiErrorRetryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Divider */}
              <View style={s.reflectionDivider} />

              {/* Journal Question */}
              <Text style={s.journalQuestion}>
                How did this week actually feel to you?
              </Text>

              <TextInput
                style={s.journalInput}
                placeholder="Write your thoughts here..."
                placeholderTextColor={theme.textTertiary}
                value={reflectionText}
                onChangeText={setReflectionText}
                multiline
              />

              {/* Mood selector */}
              <Text style={s.moodQuestion}>
                How would you describe this week overall?
              </Text>
              <View style={s.moodRow}>
                {moods.map((mood) => (
                  <TouchableOpacity
                    key={mood.key}
                    style={[s.moodPill, selectedMood === mood.key && s.moodPillActive]}
                    onPress={() => setSelectedMood(mood.key)}
                  >
                    <Text style={{ fontSize: 16 }}>{mood.emoji}</Text>
                    <Text style={[s.moodPillText, selectedMood === mood.key && s.moodPillTextActive]}>
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, savingReflection && { opacity: 0.6 }]}
                onPress={handleSaveReflection}
                disabled={savingReflection}
              >
                {savingReflection ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>
                    {reflectionSaved ? 'Update reflection' : 'Save reflection'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ===== PAST REFLECTIONS ===== */}
            {pastReflections.length > 0 && (
              <View style={s.sectionPadded}>
                <TouchableOpacity
                  onPress={() => setShowPastReflections(!showPastReflections)}
                  style={s.pastHeader}
                >
                  <Text style={s.sectionTitle}>Past Reflections</Text>
                  <Text style={s.pastToggle}>
                    {showPastReflections ? 'Hide' : `View all (${pastReflections.length})`}
                  </Text>
                </TouchableOpacity>

                {showPastReflections && pastReflections.map((r, i) => {
                  const weekDate = new Date(r.week_start + 'T00:00:00');
                  const weekEnd = new Date(weekDate);
                  weekEnd.setDate(weekDate.getDate() + 6);
                  const label = `${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                  const moodEmoji = moods.find((m) => m.key === r.mood)?.emoji || '';

                  return (
                    <View key={i} style={s.pastCard}>
                      <View style={s.pastCardHeader}>
                        <Text style={s.pastDate}>{label}</Text>
                        {moodEmoji ? <Text style={{ fontSize: 18 }}>{moodEmoji}</Text> : null}
                      </View>
                      {r.reflection_text ? (
                        <Text style={s.pastText}>{r.reflection_text}</Text>
                      ) : (
                        <Text style={[s.pastText, { fontStyle: 'italic' }]}>No written reflection</Text>
                      )}
      </View>
                  );
                })}
      </View>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
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

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: t.textPrimary },

  // Sections
  sectionPadded: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: t.textPrimary },
  sectionSub: { fontSize: 12, color: t.textTertiary, marginTop: 4, marginBottom: 12 },

  // Card
  card: {
    marginHorizontal: 20,
    backgroundColor: t.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },

  // AI Loading
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  aiLoadingText: { fontSize: 13, color: t.textSecondary },

  // ===== Neglected Areas =====
  neglectedEmpty: {
    backgroundColor: t.cardBg,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  neglectedEmptyText: { fontSize: 13, color: t.success, fontWeight: '600' },
  neglectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  neglectedIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neglectedTitle: { fontSize: 14, fontWeight: '600', color: t.textPrimary },
  neglectedDesc: { fontSize: 11, color: t.textTertiary, marginTop: 2 },

  // ===== Behavioural Mirror =====
  mirrorTitleBadge: {
    backgroundColor: t.primaryMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  mirrorTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: t.primary,
  },
  mirrorTabs: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  mirrorTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  mirrorTabActive: {
    backgroundColor: t.elevated || t.cardBg,
  },
  mirrorTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textTertiary,
  },
  mirrorTabTextActive: {
    color: t.textPrimary,
    fontWeight: '700',
  },
  mirrorContent: {
    minHeight: 60,
  },
  mirrorItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  mirrorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  mirrorItem: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  mirrorEmptySpots: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  mirrorEmptySpotsText: {
    fontSize: 13,
    color: t.success,
    fontWeight: '500',
    textAlign: 'center',
  },
  mirrorDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surfaceBorder,
  },
  indicatorDotActive: {
    backgroundColor: t.primary,
  },
  mirrorPlaceholder: {
    fontSize: 13,
    color: t.textTertiary,
    paddingVertical: 16,
    textAlign: 'center',
  },

  // ===== Weekly Reflections =====
  reflectionSections: {
    marginTop: 14,
  },
  reflectionBlock: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.surfaceBorder,
  },
  reflectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reflectionText: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 20,
  },
  reflectionPlaceholder: {
    fontSize: 13,
    color: t.textTertiary,
    paddingVertical: 16,
    textAlign: 'center',
  },
  reflectionDivider: {
    height: 1,
    backgroundColor: t.surfaceBorder,
    marginVertical: 16,
  },

  // Journal
  journalQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: t.textPrimary,
    marginBottom: 10,
  },
  journalInput: {
    backgroundColor: t.inputBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: t.inputBorder,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  // Mood
  moodQuestion: {
    fontSize: 13,
    color: t.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
  },
  moodPillActive: {
    backgroundColor: t.primaryMuted,
    borderColor: t.primary,
  },
  moodPillText: { fontSize: 12, fontWeight: '600', color: t.textTertiary },
  moodPillTextActive: { color: t.primary },

  // Save Button
  saveBtn: {
    backgroundColor: t.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Past Reflections
  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pastToggle: { color: t.primary, fontSize: 13, fontWeight: '600' },
  pastCard: {
    backgroundColor: t.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  pastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pastDate: { fontSize: 12, fontWeight: '700', color: t.textSecondary },
  pastText: { fontSize: 13, color: t.textPrimary, lineHeight: 20 },

  // AI Error Card styles
  aiErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
  },
  aiErrorCardLimit: {
    backgroundColor: '#FFFBEB18',
    borderColor: '#FDE68A50',
  },
  aiErrorCardGeneric: {
    backgroundColor: '#FEF2F218',
    borderColor: '#FECACA50',
  },
  aiErrorCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiErrorCardMsg: {
    fontSize: 12,
    color: t.textSecondary,
    lineHeight: 17,
  },
  aiErrorRetryBtn: {
    backgroundColor: t.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 8,
  },
  aiErrorRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});