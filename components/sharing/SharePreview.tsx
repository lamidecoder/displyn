import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';

const SHARE_ICON = require('../../assets/icons/share-icon.png');
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

import ShareCard from './ShareCard';
import { ShareData, ShareFormat, GradientBg } from './types';
import WeeklyStatsCard from './templates/WeeklyStatsCard';
import StreakCard from './templates/StreakCard';
import NylaMirrorCard from './templates/NylaMirrorCard';
import ChallengeCard from './templates/ChallengeCard';
import MonthlyReflectionCard from './templates/MonthlyReflectionCard';

interface SharePreviewProps {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  data: ShareData;
  format: ShareFormat;
  backgroundImage: string | null;
  gradientBg: GradientBg | null;
}

function renderTemplate(data: ShareData) {
  switch (data.type) {
    case 'weekly_stats':
      return (
        <WeeklyStatsCard
          streak={data.streak}
          completionRate={data.completionRate}
          done={data.done}
          missed={data.missed}
          bestDay={data.bestDay}
          weekRange={data.weekRange}
          displayName={data.displayName}
        />
      );
    case 'streak':
      return (
        <StreakCard
          streak={data.streak}
          completionRate={data.completionRate}
          totalDone={data.totalDone}
        />
      );
    case 'nyla_mirror':
      return (
        <NylaMirrorCard
          title={data.title}
          strengths={data.strengths}
          blindSpots={data.blindSpots}
          primaryTag={data.primaryTag}
        />
      );
    case 'challenge':
      return (
        <ChallengeCard
          challengeName={data.challengeName}
          targetAmount={data.targetAmount}
          targetUnit={data.targetUnit}
          currentProgress={data.currentProgress}
          durationDays={data.durationDays}
          dailyAverage={data.dailyAverage}
        />
      );
    case 'monthly_reflection':
      return (
        <MonthlyReflectionCard
          month={data.month}
          completionRate={data.completionRate}
          streak={data.streak}
          totalTasks={data.totalTasks}
          nylaSummary={data.nylaSummary}
          topTag={data.topTag}
          topTagIcon={data.topTagIcon}
        />
      );
  }
}

export default function SharePreview({
  visible,
  onClose,
  onDone,
  data,
  format,
  backgroundImage,
  gradientBg,
}: SharePreviewProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [busy, setBusy] = useState(false);

  const capture = async (): Promise<string | null> => {
    try {
      const uri = await (viewShotRef.current as any)?.capture?.();
      return uri || null;
    } catch {
      Alert.alert('Error', 'Could not capture image. Please try again.');
      return null;
    }
  };

  const handleShare = async () => {
    setBusy(true);
    const uri = await capture();
    setBusy(false);
    if (!uri) return;

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Displyn insight' });
  };

  const handleSave = async () => {
    setBusy(true);
    const uri = await capture();
    if (!uri) { setBusy(false); return; }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      setBusy(false);
      Alert.alert(
        'Gallery Access Needed',
        'Displyn needs gallery access to save your share card.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      setBusy(false);
      Alert.alert('Saved', 'Image saved to your gallery.');
    } catch {
      setBusy(false);
      Alert.alert('Error', 'Could not save image.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.previewWrap}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1 }}
            style={styles.viewShot}
          >
            <ShareCard format={format} backgroundImage={backgroundImage} gradientBg={gradientBg}>
              {renderTemplate(data)}
            </ShareCard>
          </ViewShot>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave} disabled={busy}>
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.secondaryBtnText}>Save to Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Image source={SHARE_ICON} style={{ width: 20, height: 20, tintColor: '#FFFFFF' }} />
                <Text style={styles.primaryBtnText}>Share</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  previewWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  viewShot: { borderRadius: 24, overflow: 'hidden' },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E26',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C5CFC',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
