import React, { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';

const SECTIONS = [
  {
    title: '1. Introduction',
    body: `This Privacy Policy explains how Cleverfolks AI Limited ("Cleverfolks," "we," "us," or "our") collects, uses, stores, and protects personal information when you use the Displyn mobile application and related services.\n\nCleverfolks AI Limited is a company registered in England and Wales (registered office: 128 City Road, London, EC1V 2NX, United Kingdom). For the purposes of the UK GDPR and the Data Protection Act 2018, Cleverfolks AI Limited is the data controller of your personal information.`,
  },
  {
    title: '2. Age Requirement',
    body: 'Displyn is intended for users aged 13 and over. We do not knowingly collect personal data from children under 13. If you are a parent or guardian and believe we have collected information from a child under 13, please contact us at support@displyn.com.',
  },
  {
    title: '3. Information We Collect',
    body: `Account information: your email address and password.\n\nProfile information: the display name you choose.\n\nContent you create: tasks, habits, challenges, goals, and any other content you enter.\n\nVoice input: voice recordings are sent for transcription only and immediately discarded — not stored by Displyn.\n\nBehavioural data: task completion records, streaks, timestamps, and patterns.\n\nAI interactions: messages with Nyla and context shared with AI providers to generate responses.\n\nPush notification token: to deliver notifications you have enabled.\n\nDevice timezone: to schedule reminders at the correct local time.`,
  },
  {
    title: '4. Legal Bases for Processing',
    body: 'We process your data based on: performance of a contract (to deliver the service), legitimate interests (security, stability, product improvement), consent (push notifications, marketing), and legal obligation (tax and accounting records).',
  },
  {
    title: '5. Third-Party Service Providers',
    body: `Supabase: stores all user data on servers in Frankfurt, Germany (EU).\n\nAI providers (Anthropic / OpenAI): power Nyla coaching and voice transcription. Providers are contractually bound not to train models on your content.\n\nExpo: routes push notifications to Apple and Google.\n\nApple and Google: process all payments and handle push delivery on their platforms.`,
  },
  {
    title: '6. International Data Transfers',
    body: 'Where your data is transferred outside the UK or EEA (e.g. to AI providers in the US), we use the UK International Data Transfer Addendum to the European Commission\'s Standard Contractual Clauses.',
  },
  {
    title: '7. How We Use Your Information',
    body: 'We use your data to: create and manage your account, deliver Displyn\'s features, send push notifications you enable, process purchases, respond to support requests, keep the app stable, and comply with legal obligations.',
  },
  {
    title: '8. What We Do Not Do',
    body: 'We do not sell your personal data. We do not share your data with advertisers. We do not track you across other apps or websites. We do not use your content to train AI models.',
  },
  {
    title: '9. Data Retention',
    body: 'Your data is retained while your account is active. On deletion, data is removed within 30 days. Voice recordings are not retained. Transaction records are kept for up to 6 years for legal compliance.',
  },
  {
    title: '10. Your Rights (UK GDPR)',
    body: 'You have the right to: access your data, rectification, erasure (delete your account in the App), restriction, data portability, object to processing, withdraw consent, and lodge a complaint with the ICO at ico.org.uk.\n\nContact: support@displyn.com',
  },
  {
    title: '11. Security',
    body: 'We use encryption in transit (HTTPS/TLS), encryption at rest, and strict access controls. In the event of a breach affecting your rights, we will notify the ICO within 72 hours.',
  },
  {
    title: '12. Push Notifications',
    body: 'Push notifications are optional. You can disable them in your device settings or within Displyn at any time.',
  },
  {
    title: '13. Changes to This Policy',
    body: 'We may update this policy from time to time. For material changes, we will give reasonable advance notice by email or in the App.',
  },
  {
    title: '14. Contact Us',
    body: 'Cleverfolks AI Limited\n128 City Road, London, EC1V 2NX, UK\nEmail: support@displyn.com',
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textPrimary }]}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.meta, { color: theme.textTertiary }]}>
          Cleverfolks AI Limited · Last updated: 16 April 2026
        </Text>

        {SECTIONS.map((section, idx) => (
          <View key={idx} style={s.section}>
            <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>{section.title}</Text>
            <Text style={[s.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        <View style={[s.contactCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Ionicons name="mail-outline" size={20} color={theme.primary} />
          <Text style={[s.contactText, { color: theme.textSecondary }]}>
            Questions? Contact us at{' '}
            <Text style={{ color: theme.primary, fontWeight: '600' }}>support@displyn.com</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  meta: { fontSize: 12, marginBottom: 24, lineHeight: 18 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  contactText: { flex: 1, fontSize: 14, lineHeight: 21 },
});