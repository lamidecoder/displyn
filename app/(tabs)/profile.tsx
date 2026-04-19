import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getProfile } from '../../lib/tasks';
import { getStreak } from '../../lib/analytics';
import { BADGES, BadgeDef, getEarnedBadges, getHighestBadge, getNextBadge, checkAndAwardBadges } from '../../lib/badges';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../components/Toast';
import ConfirmSheet from '../../components/ConfirmSheet';
import { useProfile } from '../../lib/ProfileContext';
import { ACCENT_PRESETS, getAccentPreset } from '../../lib/accentColors';
import { registerForPushNotifications, updateNotificationSettings, getNotificationSettings } from '../../lib/notifications';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NYLA = require('../../assets/icons/nyla-avatar.png');

const TONES = [
  { key: 'soft_coach', label: 'Soft Coach', desc: 'Supportive, calm, encouraging.' },
  { key: 'strict_mentor', label: 'Strict Mentor', desc: 'Direct, disciplined, firm.' },
  { key: 'savage', label: 'Savage Mode', desc: 'Blunt, uncomfortable, no excuses.' },
  { key: 'comedic', label: 'Comedic', desc: 'Dry humour. Still honest.' },
  { key: 'silent', label: 'Silent', desc: 'No nudges. Only data.' },
];

const AVATAR_EMOJIS = [
  { key: 'fire', emoji: '🔥' },
  { key: 'star', emoji: '⭐' },
  { key: 'rocket', emoji: '🚀' },
  { key: 'lion', emoji: '🦁' },
  { key: 'eagle', emoji: '🦅' },
  { key: 'wolf', emoji: '🐺' },
  { key: 'crown', emoji: '👑' },
  { key: 'diamond', emoji: '💎' },
  { key: 'bolt', emoji: '⚡' },
  { key: 'ninja', emoji: '🥷' },
  { key: 'alien', emoji: '👾' },
  { key: 'heart', emoji: '💜' },
];

type SectionKey = 'profile' | 'preferences' | 'notifications' | 'security' | 'about' | 'help';

const SECTIONS: { key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
  { key: 'preferences', label: 'Preferences', icon: 'color-palette-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'security', label: 'Security', icon: 'lock-closed-outline' },
  { key: 'about', label: 'About', icon: 'information-circle-outline' },
  { key: 'help', label: 'Help & Support', icon: 'help-circle-outline' },
];

export default function ProfileScreen() {
  const { theme, preference, setMode, accentKey, setAccentColor, isDark } = useTheme();
  const { refresh: refreshProfile } = useProfile();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');
  const [notificationTone, setNotificationTone] = useState('strict_mentor');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([]);
  const [aiCallsUsed, setAiCallsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);

  // Accordion
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);

  // Modal states
  const [editNameModal, setEditNameModal] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [toneModal, setToneModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [badgeModal, setBadgeModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const toast = useToast();
  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean; title: string; message: string;
    confirmLabel: string; destructive: boolean; icon: string; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', confirmLabel: 'Confirm', destructive: false, icon: 'alert-circle', onConfirm: () => {} });
  const showConfirm = (cfg: Omit<typeof confirmSheet, 'visible'>) => setConfirmSheet({ ...cfg, visible: true });
  const hideConfirm = () => setConfirmSheet(prev => ({ ...prev, visible: false }));
  const [colorPickerModal, setColorPickerModal] = useState(false);
  const [avatarPickerModal, setAvatarPickerModal] = useState(false);
  const [supportModal, setSupportModal] = useState(false);

  // Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState('09:00');
  const [eveningTime, setEveningTime] = useState('20:00');
  const [showMorningPicker, setShowMorningPicker] = useState(false);
  const [showEveningPicker, setShowEveningPicker] = useState(false);
  const [overdueNotifEnabled, setOverdueNotifEnabled] = useState(true);
  const [streakNotifEnabled, setStreakNotifEnabled] = useState(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [dailySummaryTime, setDailySummaryTime] = useState('20:00');
  const [showSummaryTimePicker, setShowSummaryTimePicker] = useState(false);
  const [reminderMinsBefore, setReminderMinsBefore] = useState(30);

  const s = makeStyles(theme);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const [profile, streak, badges] = await Promise.all([
        getProfile(user.id),
        getStreak(user.id),
        getEarnedBadges(user.id),
      ]);

      setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'User');
      setTimezone(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setNotificationTone(profile?.notification_tone || 'strict_mentor');
      setCurrentStreak(streak);
      setEarnedBadgeIds(badges);

      const savedEmoji = await AsyncStorage.getItem('avatar_emoji');
      if (savedEmoji) {
        setAvatarEmoji(savedEmoji);
      } else if (profile?.avatar_emoji) {
        setAvatarEmoji(profile.avatar_emoji);
        await AsyncStorage.setItem('avatar_emoji', profile.avatar_emoji);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('call_count')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .single();
      setAiCallsUsed(usage?.call_count || 0);

      try {
        const notifSettings = await getNotificationSettings(user.id);
        setNotificationsEnabled(notifSettings.notifications_enabled);
        setMorningTime(notifSettings.morning_reminder_time);
        setEveningTime(notifSettings.evening_reminder_time);
        setOverdueNotifEnabled(notifSettings.overdue_notifications_enabled);
        setStreakNotifEnabled(notifSettings.streak_notifications_enabled);
        setDailySummaryEnabled(notifSettings.daily_summary_enabled);
        setDailySummaryTime(notifSettings.daily_summary_time);
        setReminderMinsBefore(notifSettings.reminder_minutes_before);
      } catch { /* defaults already set */ }

      await checkAndAwardBadges(user.id, streak);
      const updatedBadges = await getEarnedBadges(user.id);
      setEarnedBadgeIds(updatedBadges);
    } catch (e: any) {
      console.error('Error loading profile:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ===== Handlers =====

  const toggleSection = (key: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === key ? null : key);
  };

  const handleSaveName = async () => {
    if (!editNameValue.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ display_name: editNameValue.trim() }).eq('id', user.id);
      setDisplayName(editNameValue.trim());
      setEditNameModal(false);
      refreshProfile();
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    }
  };

  const handleSaveTone = async (tone: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ notification_tone: tone }).eq('id', user.id);
      await AsyncStorage.setItem('notification_tone', tone);
      setNotificationTone(tone);
      setToneModal(false);
      refreshProfile();
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    }
  };

  const handleSelectAvatar = async (emojiKey: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const emojiValue = emojiKey
        ? AVATAR_EMOJIS.find(a => a.key === emojiKey)?.emoji || null
        : null;
      setAvatarEmoji(emojiValue);
      if (emojiValue) {
        await AsyncStorage.setItem('avatar_emoji', emojiValue);
      } else {
        await AsyncStorage.removeItem('avatar_emoji');
      }
      await supabase.from('profiles').update({ avatar_emoji: emojiValue }).eq('id', user.id);
      setAvatarPickerModal(false);
      refreshProfile();
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Oops', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Oops', 'Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Done!', 'Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordModal(false);
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    if (val) {
      await registerForPushNotifications();
    }
    await updateNotificationSettings({ notifications_enabled: val });
  };

  const handleMorningTimeChange = async (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowMorningPicker(false);
    if (selectedDate) {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      setMorningTime(timeStr);
      await updateNotificationSettings({ morning_reminder_time: timeStr });
    }
  };

  const handleEveningTimeChange = async (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEveningPicker(false);
    if (selectedDate) {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      setEveningTime(timeStr);
      await updateNotificationSettings({ evening_reminder_time: timeStr });
    }
  };

  const handleSummaryTimeChange = async (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowSummaryTimePicker(false);
    if (selectedDate) {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      setDailySummaryTime(timeStr);
      await updateNotificationSettings({ daily_summary_time: timeStr });
    }
  };

  const handleToggleOverdue = async (val: boolean) => {
    setOverdueNotifEnabled(val);
    await updateNotificationSettings({ overdue_notifications_enabled: val });
  };

  const handleToggleStreak = async (val: boolean) => {
    setStreakNotifEnabled(val);
    await updateNotificationSettings({ streak_notifications_enabled: val });
  };

  const handleToggleDailySummary = async (val: boolean) => {
    setDailySummaryEnabled(val);
    await updateNotificationSettings({ daily_summary_enabled: val });
  };

  const handleReminderMinsChange = async (mins: number) => {
    setReminderMinsBefore(mins);
    await updateNotificationSettings({ reminder_minutes_before: mins });
  };

  const parseTimeToDate = (timeStr: string): Date => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatTimeDisplay = (timeStr: string): string => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleCycleTheme = () => {
    if (preference === 'dark') setMode('light');
    else if (preference === 'light') setMode('system');
    else setMode('dark');
  };

  const themeLabel = preference === 'dark' ? 'Dark' : preference === 'light' ? 'Light' : 'System';
  const toneLabel = TONES.find(t => t.key === notificationTone)?.label || 'Strict Mentor';

  const handleLogout = () => {
    showConfirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log Out',
      destructive: true,
      icon: 'log-out-outline',
      onConfirm: async () => { hideConfirm(); await supabase.auth.signOut(); },
    });
  };

  const handleDeleteAccount = () => {
    showConfirm({
      title: 'Delete Account',
      message: 'This will permanently delete your account and all your data. This cannot be undone.',
      confirmLabel: 'Request Deletion',
      destructive: true,
      icon: 'trash-outline',
      onConfirm: () => { hideConfirm(); setTimeout(() => toast.info('Contact Support', 'Email support@displyn.com to request account deletion.'), 400); },
    });
  };

  const openExternal = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Cannot open URL');
      await Linking.openURL(url);
    } catch {
      toast.warning('Unavailable', 'Could not open link right now.');
    }
  };

  const handleReviewApp = async () => {
    if (Platform.OS === 'android') {
      await openExternal('https://play.google.com/store/apps/details?id=com.displyn.app');
      return;
    }
    toast.info('Coming soon', 'App Store review link will be live once the listing is active.');
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'I am using Displyn to stay consistent every day. Try it: https://displyn.app',
        url: 'https://displyn.app',
      });
    } catch {}
  };

  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const highestBadge = getHighestBadge(earnedBadgeIds);
  const nextBadge = getNextBadge(earnedBadgeIds);

  const earnedBadges = BADGES.filter(b => earnedBadgeIds.includes(b.id));
  const recentEarned = earnedBadges.slice(-3).reverse();

  const renderSectionHeader = (section: typeof SECTIONS[number]) => {
    const isOpen = expandedSection === section.key;
    return (
      <TouchableOpacity
        key={section.key}
        style={[s.accordionHeader, isOpen && s.accordionHeaderOpen]}
        onPress={() => toggleSection(section.key)}
        activeOpacity={0.7}
      >
        <View style={s.accordionHeaderLeft}>
          <Ionicons name={section.icon as any} size={20} color={theme.primary} />
          <Text style={s.accordionHeaderText}>{section.label}</Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textTertiary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
        </View>

        {/* Avatar + Name + Streak — always visible */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={() => setAvatarPickerModal(true)} activeOpacity={0.8}>
            <View style={s.avatarCircle}>
              {avatarEmoji ? (
                <Text style={s.avatarEmoji}>{avatarEmoji}</Text>
              ) : (
                <Text style={s.avatarText}>{avatarInitial}</Text>
              )}
              <View style={s.avatarEditBadge}>
                <Ionicons name="pencil" size={12} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={s.displayName}>{loading ? '...' : displayName}</Text>
          <Text style={s.emailText}>{email}</Text>
          {currentStreak > 0 && (
            <View style={s.streakBadge}>
              <Text style={s.streakIcon}>🔥</Text>
              <Text style={s.streakText}>{currentStreak} day streak</Text>
            </View>
          )}
          {highestBadge && (
            <View style={[s.currentBadge, { borderColor: highestBadge.color + '60' }]}>
              <Text style={{ fontSize: 16 }}>{highestBadge.icon}</Text>
              <Text style={[s.currentBadgeText, { color: highestBadge.color }]}>{highestBadge.title}</Text>
            </View>
          )}
        </View>

        {/* ===== BADGES SHELF — always visible ===== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>BADGES</Text>
            <TouchableOpacity onPress={() => setBadgeModal(true)}>
              <Text style={s.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>
          {recentEarned.length === 0 ? (
            <View style={s.badgeEmptyCard}>
              <Text style={s.badgeEmptyIcon}>🏅</Text>
              <Text style={s.badgeEmptyText}>Complete a 3-day streak to earn your first badge!</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.badgeShelfScroll}
            >
              {recentEarned.map((badge) => (
                <View key={badge.id} style={[s.badgeShelfCard, { borderColor: badge.color + '50' }]}>
                  <View style={[s.badgeShelfIconRing, { borderColor: badge.color + '60' }]}>
                    <Text style={{ fontSize: 30 }}>{badge.icon}</Text>
                  </View>
                  <Text style={[s.badgeShelfTitle, { color: badge.color }]}>{badge.title}</Text>
                  <Text style={s.badgeShelfReq}>{badge.streakRequired}d streak</Text>
                </View>
              ))}
            </ScrollView>
          )}
          {nextBadge && (
            <View style={s.nextBadgeRow}>
              <View style={s.nextBadgeProgress}>
                <View style={[s.nextBadgeProgressFill, {
                  width: `${Math.min(100, (currentStreak / nextBadge.streakRequired) * 100)}%`,
                  backgroundColor: nextBadge.color,
                }]} />
              </View>
              <Text style={s.nextBadgeText}>
                {nextBadge.icon} {nextBadge.title} — {Math.max(0, nextBadge.streakRequired - currentStreak)} days to go
              </Text>
            </View>
          )}
        </View>

        {/* ===== ACCORDION SECTIONS ===== */}
        <View style={s.accordionContainer}>
          {/* PROFILE */}
          {renderSectionHeader(SECTIONS[0])}
          {expandedSection === 'profile' && (
            <View style={s.accordionContent}>
              <TouchableOpacity
                style={[s.menuRow, s.menuRowBorder]}
                onPress={() => { setEditNameValue(displayName); setEditNameModal(true); }}
              >
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Display Name</Text>
                </View>
                <Text style={s.menuRowValue}>{displayName}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} activeOpacity={1}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Email</Text>
                </View>
                <Text style={s.menuRowValueDim}>{email}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.menuRow} activeOpacity={1}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Timezone</Text>
                </View>
                <Text style={s.menuRowValueDim}>{timezone}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PREFERENCES */}
          {renderSectionHeader(SECTIONS[1])}
          {expandedSection === 'preferences' && (
            <View style={s.accordionContent}>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={handleCycleTheme}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Theme</Text>
                </View>
                <Text style={s.menuRowValue}>{themeLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => setColorPickerModal(true)}>
                <View style={s.menuRowLeft}>
                  <View style={[s.menuDot, { backgroundColor: theme.primary }]} />
                  <Text style={s.menuRowText}>Theme Color</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.menuRowValue}>{getAccentPreset(accentKey).label}</Text>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: theme.primary }} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => setToneModal(true)}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Nyla's Tone</Text>
                </View>
                <Text style={s.menuRowValue}>{toneLabel}</Text>
              </TouchableOpacity>
              <View style={s.menuRow}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>AI Usage Today</Text>
                </View>
                <Text style={[s.menuRowValue, aiCallsUsed >= 40 && { color: theme.error }]}>{aiCallsUsed}/40</Text>
              </View>
            </View>
          )}

          {/* NOTIFICATIONS */}
          {renderSectionHeader(SECTIONS[2])}
          {expandedSection === 'notifications' && (
            <View style={s.accordionContent}>
              <View style={[s.menuRow, s.menuRowBorder]}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Push Notifications</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: theme.surfaceBorder, true: theme.primary + '60' }}
                  thumbColor={notificationsEnabled ? theme.primary : '#ccc'}
                />
              </View>
              {notificationsEnabled && (
                <>
                  <TouchableOpacity
                    style={[s.menuRow, s.menuRowBorder]}
                    onPress={() => setShowMorningPicker(true)}
                  >
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Morning Reminder</Text>
                        <Text style={s.menuRowHint}>Daily tasks + overdue + challenges</Text>
                      </View>
                    </View>
                    <Text style={s.menuRowValue}>{formatTimeDisplay(morningTime)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.menuRow, s.menuRowBorder]}
                    onPress={() => setShowEveningPicker(true)}
                  >
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Evening Reminder</Text>
                        <Text style={s.menuRowHint}>Streak at risk (only if 0 tasks done)</Text>
                      </View>
                    </View>
                    <Text style={s.menuRowValue}>{formatTimeDisplay(eveningTime)}</Text>
                  </TouchableOpacity>

                  <View style={[s.menuRow, s.menuRowBorder]}>
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Overdue Alerts</Text>
                        <Text style={s.menuRowHint}>Per-task overdue notifications</Text>
                      </View>
                    </View>
                    <Switch
                      value={overdueNotifEnabled}
                      onValueChange={handleToggleOverdue}
                      trackColor={{ false: theme.surfaceBorder, true: theme.primary + '60' }}
                      thumbColor={overdueNotifEnabled ? theme.primary : '#ccc'}
                    />
                  </View>

                  <View style={[s.menuRow, s.menuRowBorder]}>
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Streak Alerts</Text>
                        <Text style={s.menuRowHint}>Milestones and at-risk warnings</Text>
                      </View>
                    </View>
                    <Switch
                      value={streakNotifEnabled}
                      onValueChange={handleToggleStreak}
                      trackColor={{ false: theme.surfaceBorder, true: theme.primary + '60' }}
                      thumbColor={streakNotifEnabled ? theme.primary : '#ccc'}
                    />
                  </View>

                  <View style={[s.menuRow, s.menuRowBorder]}>
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Daily Summary</Text>
                        <Text style={s.menuRowHint}>End-of-day completion recap</Text>
                      </View>
                    </View>
                    <Switch
                      value={dailySummaryEnabled}
                      onValueChange={handleToggleDailySummary}
                      trackColor={{ false: theme.surfaceBorder, true: theme.primary + '60' }}
                      thumbColor={dailySummaryEnabled ? theme.primary : '#ccc'}
                    />
                  </View>

                  {dailySummaryEnabled && (
                    <TouchableOpacity
                      style={[s.menuRow, s.menuRowBorder]}
                      onPress={() => setShowSummaryTimePicker(true)}
                    >
                      <View style={s.menuRowLeft}>
                        <View style={s.menuDot} />
                        <View>
                          <Text style={s.menuRowText}>Summary Time</Text>
                          <Text style={s.menuRowHint}>When to receive daily recap</Text>
                        </View>
                      </View>
                      <Text style={s.menuRowValue}>{formatTimeDisplay(dailySummaryTime)}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={s.menuRow}
                    onPress={() => {
                      const options = [15, 30, 45, 60];
                      const labels = options.map(m => m === reminderMinsBefore ? `${m} min ✓` : `${m} min`);
                      showConfirm({
                        title: 'Reminder Lead Time',
                        message: `Currently ${reminderMinsBefore} min before. Tap confirm to set the next option.`,
                        confirmLabel: `Set to ${[15,30,45,60][([15,30,45,60].indexOf(reminderMinsBefore)+1)%4]} min`,
                        destructive: false,
                        icon: 'alarm-outline',
                        onConfirm: () => { handleReminderMinsChange([15,30,45,60][([15,30,45,60].indexOf(reminderMinsBefore)+1)%4]); hideConfirm(); },
                      });
                    }}
                  >
                    <View style={s.menuRowLeft}>
                      <View style={s.menuDot} />
                      <View>
                        <Text style={s.menuRowText}>Reminder Lead Time</Text>
                        <Text style={s.menuRowHint}>Minutes before task is due</Text>
                      </View>
                    </View>
                    <Text style={s.menuRowValue}>{reminderMinsBefore} min</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Time Pickers */}
          {showMorningPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={parseTimeToDate(morningTime)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleMorningTimeChange}
            />
          )}
          {showEveningPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={parseTimeToDate(eveningTime)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleEveningTimeChange}
            />
          )}
          {showSummaryTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={parseTimeToDate(dailySummaryTime)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleSummaryTimeChange}
            />
          )}

          {/* SECURITY */}
          {renderSectionHeader(SECTIONS[3])}
          {expandedSection === 'security' && (
            <View style={s.accordionContent}>
              <TouchableOpacity style={s.menuRow} onPress={() => setChangePasswordModal(true)}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* ABOUT */}
          {renderSectionHeader(SECTIONS[4])}
          {expandedSection === 'about' && (
            <View style={s.accordionContent}>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => setPrivacyModal(true)}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Privacy & Data Usage</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={handleDeleteAccount}>
                <View style={s.menuRowLeft}>
                  <View style={[s.menuDot, { backgroundColor: theme.error }]} />
                  <Text style={[s.menuRowText, { color: theme.error }]}>Delete Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.menuRow} onPress={handleLogout}>
                <View style={s.menuRowLeft}>
                  <View style={[s.menuDot, { backgroundColor: theme.error }]} />
                  <Text style={[s.menuRowText, { color: theme.error }]}>Log Out</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* HELP */}
          {renderSectionHeader(SECTIONS[5])}
          {expandedSection === 'help' && (
            <View style={s.accordionContent}>
              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={handleReviewApp}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Review on App Store</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => setSupportModal(true)}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Get Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={s.menuRow} onPress={handleShareApp}>
                <View style={s.menuRowLeft}>
                  <View style={s.menuDot} />
                  <Text style={s.menuRowText}>Share App</Text>
                </View>
                <Ionicons name="share-social-outline" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ===== EDIT NAME MODAL ===== */}
      <Modal visible={editNameModal} transparent animationType="fade" onRequestClose={() => setEditNameModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setEditNameModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Edit Display Name</Text>
            <TextInput
              style={s.modalInput}
              value={editNameValue}
              onChangeText={setEditNameValue}
              autoCapitalize="words"
              autoFocus
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setEditNameModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSaveBtn} onPress={handleSaveName}>
                <Text style={s.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== TONE SELECTOR MODAL ===== */}
      <Modal visible={toneModal} transparent animationType="fade" onRequestClose={() => setToneModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setToneModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Image source={NYLA} style={{ width: 48, height: 48, backgroundColor: 'transparent' }} resizeMode="contain" />
            </View>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>How should Nyla talk to you?</Text>
            {TONES.map((tone) => {
              const isSelected = notificationTone === tone.key;
              return (
                <TouchableOpacity
                  key={tone.key}
                  style={[s.toneOption, isSelected && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                  onPress={() => handleSaveTone(tone.key)}
                >
                  <View style={[s.toneRadio, isSelected && { backgroundColor: theme.primary }]}>
                    {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.toneName}>{tone.label}</Text>
                    <Text style={s.toneDesc}>{tone.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== CHANGE PASSWORD MODAL ===== */}
      <Modal visible={changePasswordModal} transparent animationType="fade" onRequestClose={() => setChangePasswordModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setChangePasswordModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Change Password</Text>
            <TextInput
              style={s.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New password"
              placeholderTextColor={theme.textTertiary}
            />
            <TextInput
              style={[s.modalInput, { marginTop: 12 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm password"
              placeholderTextColor={theme.textTertiary}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setChangePasswordModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSaveBtn} onPress={handleChangePassword} disabled={passwordLoading}>
                {passwordLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalSaveText}>Update</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== ALL BADGES MODAL — full sheet ===== */}
      <Modal visible={badgeModal} transparent animationType="slide" onRequestClose={() => setBadgeModal(false)}>
        <View style={s.badgeModalContainer}>
          <View style={s.badgeModalSheet}>
            {/* Handle + Header */}
            <View style={s.badgeModalHandle} />
            <View style={s.badgeModalHeader}>
              <Text style={s.badgeModalTitle}>Badge Collection</Text>
              <TouchableOpacity onPress={() => setBadgeModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Streak + Progress */}
            <View style={s.badgeModalStats}>
              <Text style={s.badgeModalStreak}>🔥 {currentStreak} day streak</Text>
              <View style={s.badgeProgressContainer}>
                <View style={s.badgeProgressBar}>
                  <View style={[s.badgeProgressFill, { width: `${Math.min(100, (earnedBadgeIds.length / BADGES.length) * 100)}%` }]} />
                </View>
                <Text style={s.badgeProgressText}>{earnedBadgeIds.length}/{BADGES.length}</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Earned badges */}
              {earnedBadges.length > 0 && (
                <View style={s.badgeModalSection}>
                  <Text style={s.badgeModalSectionLabel}>EARNED</Text>
                  <View style={s.badgeGrid}>
                    {earnedBadges.map((badge) => (
                      <View key={badge.id} style={[s.badgeGridCard, { borderColor: badge.color + '50', borderWidth: 1.5 }]}>
                        <View style={[s.badgeGridCircle, { borderColor: badge.color }]}>
                          <Text style={{ fontSize: 26 }}>{badge.icon}</Text>
                          <View style={[s.badgeCheckmark, { backgroundColor: theme.success }]}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        </View>
                        <Text style={s.badgeGridTitle} numberOfLines={1}>{badge.title}</Text>
                        <Text style={s.badgeGridDesc} numberOfLines={2}>{badge.description}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Locked badges */}
              {BADGES.filter(b => !earnedBadgeIds.includes(b.id)).length > 0 && (
                <View style={s.badgeModalSection}>
                  <Text style={s.badgeModalSectionLabel}>LOCKED</Text>
                  <View style={s.badgeGrid}>
                    {BADGES.filter(b => !earnedBadgeIds.includes(b.id)).map((badge) => {
                      const progress = Math.min(1, currentStreak / badge.streakRequired);
                      return (
                        <View key={badge.id} style={[s.badgeGridCard, { borderColor: theme.surfaceBorder, borderWidth: 1 }]}>
                          <View style={[s.badgeGridCircle, { borderColor: theme.surfaceBorder, opacity: 0.5 }]}>
                            <Text style={{ fontSize: 26 }}>{badge.icon}</Text>
                            <View style={[s.badgeCheckmark, { backgroundColor: theme.textTertiary }]}>
                              <Ionicons name="lock-closed" size={9} color="#fff" />
                            </View>
                          </View>
                          <Text style={[s.badgeGridTitle, { opacity: 0.5 }]} numberOfLines={1}>{badge.title}</Text>
                          <View style={s.badgeGridMiniProgress}>
                            <View style={[s.badgeGridMiniProgressFill, { width: `${progress * 100}%`, backgroundColor: badge.color }]} />
                          </View>
                          <Text style={s.badgeGridReq}>{badge.streakRequired} days</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== AVATAR PICKER MODAL ===== */}
      <Modal visible={avatarPickerModal} transparent animationType="fade" onRequestClose={() => setAvatarPickerModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setAvatarPickerModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Choose Avatar</Text>
            <View style={s.avatarGrid}>
              {/* Initial option */}
              <TouchableOpacity
                style={[s.avatarGridItem, !avatarEmoji && s.avatarGridItemSelected]}
                onPress={() => handleSelectAvatar(null)}
              >
                <View style={[s.avatarGridCircle, !avatarEmoji && { borderColor: theme.primary }]}>
                  <Text style={[s.avatarGridLetter, { color: theme.primary }]}>{avatarInitial}</Text>
                </View>
                <Text style={s.avatarGridLabel}>Initial</Text>
              </TouchableOpacity>
              {AVATAR_EMOJIS.map((av) => {
                const isSelected = avatarEmoji === av.emoji;
                return (
                  <TouchableOpacity
                    key={av.key}
                    style={[s.avatarGridItem, isSelected && s.avatarGridItemSelected]}
                    onPress={() => handleSelectAvatar(av.key)}
                  >
                    <View style={[s.avatarGridCircle, isSelected && { borderColor: theme.primary }]}>
                      <Text style={{ fontSize: 28 }}>{av.emoji}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== IOS MORNING TIME PICKER MODAL ===== */}
      {Platform.OS === 'ios' && (
        <Modal visible={showMorningPicker} transparent animationType="fade" onRequestClose={() => setShowMorningPicker(false)}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowMorningPicker(false)}>
            <Pressable style={s.modalCard} onPress={() => {}}>
              <Text style={[s.modalTitle, { textAlign: 'center' }]}>Morning Reminder Time</Text>
              <DateTimePicker
                value={parseTimeToDate(morningTime)}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleMorningTimeChange}
                style={{ height: 180 }}
              />
              <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 12, alignSelf: 'stretch' }]} onPress={() => setShowMorningPicker(false)}>
                <Text style={s.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ===== IOS EVENING TIME PICKER MODAL ===== */}
      {Platform.OS === 'ios' && (
        <Modal visible={showEveningPicker} transparent animationType="fade" onRequestClose={() => setShowEveningPicker(false)}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowEveningPicker(false)}>
            <Pressable style={s.modalCard} onPress={() => {}}>
              <Text style={[s.modalTitle, { textAlign: 'center' }]}>Evening Reminder Time</Text>
              <DateTimePicker
                value={parseTimeToDate(eveningTime)}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleEveningTimeChange}
                style={{ height: 180 }}
              />
              <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 12, alignSelf: 'stretch' }]} onPress={() => setShowEveningPicker(false)}>
                <Text style={s.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ===== IOS SUMMARY TIME PICKER MODAL ===== */}
      {Platform.OS === 'ios' && (
        <Modal visible={showSummaryTimePicker} transparent animationType="fade" onRequestClose={() => setShowSummaryTimePicker(false)}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowSummaryTimePicker(false)}>
            <Pressable style={s.modalCard} onPress={() => {}}>
              <Text style={[s.modalTitle, { textAlign: 'center' }]}>Daily Summary Time</Text>
              <DateTimePicker
                value={parseTimeToDate(dailySummaryTime)}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleSummaryTimeChange}
                style={{ height: 180 }}
              />
              <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 12, alignSelf: 'stretch' }]} onPress={() => setShowSummaryTimePicker(false)}>
                <Text style={s.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ===== PRIVACY MODAL ===== */}
      <Modal visible={privacyModal} transparent animationType="fade" onRequestClose={() => setPrivacyModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setPrivacyModal(false)}>
          <Pressable style={[s.modalCard, { maxHeight: '75%' }]} onPress={() => {}}>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Privacy & Data Usage</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              <Text style={s.privacyHeading}>What we collect</Text>
              <Text style={s.privacyText}>
                • Your task data (titles, tags, completion status, dates){'\n'}
                • Your profile information (name, email, timezone){'\n'}
                • Your streak and badge progress{'\n'}
                • Your journal reflections and mood selections
              </Text>
              <Text style={s.privacyHeading}>How AI uses your data</Text>
              <Text style={s.privacyText}>
                Nyla analyses your task patterns to generate insights, suggestions, and reflections. Your data is sent to OpenAI's API for processing but is not stored or used for training by OpenAI.
              </Text>
              <Text style={s.privacyHeading}>Data storage</Text>
              <Text style={s.privacyText}>
                All your data is stored securely in Supabase with row-level security. Only you can access your own data.
              </Text>
              <Text style={s.privacyHeading}>Deletion</Text>
              <Text style={s.privacyText}>
                You can request full account and data deletion at any time. Contact support@displyn.com or use the Delete Account option in settings.
              </Text>
            </ScrollView>
            <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={() => setPrivacyModal(false)}>
              <Text style={s.modalSaveText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== ACCENT COLOR PICKER MODAL ===== */}
      <Modal visible={colorPickerModal} transparent animationType="fade" onRequestClose={() => setColorPickerModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setColorPickerModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Theme Color</Text>
            <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: 'center', marginBottom: 20 }}>
              Pick a color that feels like you
            </Text>
            <View style={s.accentGrid}>
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentKey === preset.key;
                const circleColor = isDark ? preset.dark.primary : preset.light.primary;
                return (
                  <TouchableOpacity
                    key={preset.key}
                    style={s.accentCircleWrap}
                    onPress={() => setAccentColor(preset.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      s.accentCircle,
                      { backgroundColor: circleColor },
                      isSelected && { borderWidth: 3, borderColor: '#FFFFFF' },
                    ]}>
                      {isSelected && (
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>✓</Text>
                      )}
                    </View>
                    {isSelected && (
                      <View style={[s.accentGlow, { shadowColor: circleColor }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.accentLabel, { color: theme.primary }]}>{getAccentPreset(accentKey).label}</Text>
            <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 20, alignSelf: 'stretch' }]} onPress={() => setColorPickerModal(false)}>
              <Text style={s.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== SUPPORT MODAL ===== */}
      <Modal visible={supportModal} transparent animationType="fade" onRequestClose={() => setSupportModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setSupportModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Get Support</Text>
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => openExternal('https://displyn.app/faq')}>
              <Text style={s.menuRowText}>FAQs</Text>
              <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => {
              setSupportModal(false);
              toast.info('Manage Subscription', 'You can manage or cancel your subscription in your App Store / Play Store subscriptions settings.');
            }}>
              <Text style={s.menuRowText}>Cancel Subscription</Text>
              <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => openExternal('mailto:support@displyn.com?subject=Displyn%20Support')}>
              <Text style={s.menuRowText}>Contact Support</Text>
              <Ionicons name="mail-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => openExternal('https://instagram.com/displynapp')}>
              <Text style={s.menuRowText}>Instagram</Text>
              <Ionicons name="logo-instagram" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={() => openExternal('https://discord.gg/displyn')}>
              <Text style={s.menuRowText}>Discord</Text>
              <Ionicons name="chatbubbles-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuRow} onPress={() => openExternal('https://tiktok.com/@displyn')}>
              <Text style={s.menuRowText}>Tiktok</Text>
              <Ionicons name="logo-tiktok" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalSaveBtn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={() => setSupportModal(false)}>
              <Text style={s.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },

  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: t.textPrimary },

  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: t.surface, borderWidth: 2, borderColor: t.primary + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarEmoji: { fontSize: 40 },
  avatarText: { fontSize: 34, fontWeight: '700', color: t.primary },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: t.bg,
  },
  displayName: { fontSize: 20, fontWeight: '700', color: t.textPrimary },
  emailText: { fontSize: 13, color: t.textTertiary, marginTop: 4 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: t.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 12,
    borderWidth: 1, borderColor: t.surfaceBorder,
  },
  streakIcon: { fontSize: 14 },
  streakText: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
  currentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8,
    borderWidth: 1,
  },
  currentBadgeText: { fontSize: 13, fontWeight: '700' },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: t.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  seeAllText: { fontSize: 13, fontWeight: '600', color: t.primary },

  badgeShelfScroll: { paddingBottom: 4, gap: 10 },
  badgeShelfCard: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14,
    backgroundColor: t.surface, borderRadius: 16, borderWidth: 1.5, width: 110,
  },
  badgeShelfIconRing: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    backgroundColor: t.bg,
  },
  badgeShelfTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  badgeShelfReq: { fontSize: 10, color: t.textTertiary, marginTop: 3 },
  badgeEmptyCard: {
    alignItems: 'center', paddingVertical: 24,
    backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.surfaceBorder,
    marginBottom: 10,
  },
  badgeEmptyIcon: { fontSize: 32, marginBottom: 8 },
  badgeEmptyText: { fontSize: 13, color: t.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  nextBadgeRow: {
    backgroundColor: t.surface, borderRadius: 12, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: t.surfaceBorder,
  },
  nextBadgeProgress: {
    height: 4, borderRadius: 2, backgroundColor: t.surfaceBorder, marginBottom: 8, overflow: 'hidden',
  },
  nextBadgeProgressFill: { height: '100%', borderRadius: 2 },
  nextBadgeText: { fontSize: 12, color: t.textSecondary, fontWeight: '500' },

  // Accordion
  accordionContainer: { paddingHorizontal: 20, gap: 10 },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: t.surfaceBorder,
    backgroundColor: t.surface,
  },
  accordionHeaderOpen: { borderColor: t.primary + '55' },
  accordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accordionHeaderText: { fontSize: 16, fontWeight: '600', color: t.textPrimary },
  accordionContent: {
    marginTop: -4,
    marginBottom: 4,
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  // Menu rows
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: t.divider },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary },
  menuRowText: { fontSize: 16, fontWeight: '500', color: t.textPrimary },
  menuRowValue: { fontSize: 14, fontWeight: '600', color: t.primary },
  menuRowHint: { fontSize: 11, color: t.textTertiary, marginTop: 2 },
  menuRowValueDim: { fontSize: 13, fontWeight: '500', color: t.textTertiary },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: t.surface,
    borderRadius: 20, padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: t.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: t.textPrimary, borderWidth: 1, borderColor: t.surfaceBorder,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20,
  },
  modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: t.textTertiary },
  modalSaveBtn: {
    backgroundColor: t.primary, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10, alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Tone options
  toneOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: t.surfaceBorder,
  },
  toneRadio: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: t.primary + '30', alignItems: 'center', justifyContent: 'center',
  },
  toneName: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  toneDesc: { fontSize: 12, color: t.textTertiary, marginTop: 2 },

  badgeModalContainer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  badgeModalSheet: {
    backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', paddingBottom: 20,
  },
  badgeModalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: t.textTertiary + '40',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  badgeModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  badgeModalTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  badgeModalStats: { paddingHorizontal: 20, paddingBottom: 16 },
  badgeModalStreak: { fontSize: 14, fontWeight: '600', color: t.textSecondary, marginBottom: 10 },
  badgeModalSection: { paddingHorizontal: 20, marginBottom: 16 },
  badgeModalSectionLabel: {
    fontSize: 12, fontWeight: '700', color: t.textTertiary,
    letterSpacing: 0.8, marginBottom: 12,
  },
  badgeProgressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeProgressBar: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: t.surfaceBorder, overflow: 'hidden',
  },
  badgeProgressFill: { height: '100%', borderRadius: 3, backgroundColor: t.primary },
  badgeProgressText: { fontSize: 12, fontWeight: '700', color: t.textTertiary },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeGridCard: {
    width: '47%', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    backgroundColor: t.bg, borderRadius: 14,
  },
  badgeGridCircle: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.surface, marginBottom: 8,
  },
  badgeCheckmark: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: t.bg,
  },
  badgeGridTitle: { fontSize: 13, fontWeight: '700', color: t.textPrimary, textAlign: 'center' },
  badgeGridDesc: { fontSize: 10, color: t.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 14, paddingHorizontal: 2 },
  badgeGridReq: { fontSize: 11, color: t.textTertiary, marginTop: 4 },
  badgeGridMiniProgress: {
    width: '80%', height: 3, borderRadius: 1.5, backgroundColor: t.surfaceBorder,
    overflow: 'hidden', marginTop: 6,
  },
  badgeGridMiniProgressFill: { height: '100%', borderRadius: 1.5 },

  // Avatar picker grid
  avatarGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14,
    paddingVertical: 8,
  },
  avatarGridItem: {
    alignItems: 'center', width: 72, paddingVertical: 8, borderRadius: 14,
  },
  avatarGridItemSelected: {
    backgroundColor: t.primary + '15',
  },
  avatarGridCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: t.bg, borderWidth: 2, borderColor: t.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGridLetter: { fontSize: 24, fontWeight: '700' },
  avatarGridLabel: { fontSize: 11, color: t.textTertiary, marginTop: 4 },

  // Privacy
  privacyHeading: { fontSize: 15, fontWeight: '700', color: t.textPrimary, marginTop: 16, marginBottom: 6 },
  privacyText: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },

  // Accent color picker
  accentGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16,
    paddingHorizontal: 10,
  },
  accentCircleWrap: { alignItems: 'center', justifyContent: 'center', width: 52, height: 52 },
  accentCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  accentGlow: {
    position: 'absolute', width: 52, height: 52, borderRadius: 26,
    shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  accentLabel: { fontSize: 15, fontWeight: '700', marginTop: 16, textAlign: 'center' },
});