import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

const SHARE_ICON = require('../../assets/icons/share-icon.png');
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { ShareData, ShareFormat, GradientBg } from './types';
import { GRADIENT_BACKGROUNDS } from './GradientBackgrounds';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/ThemeContext';
import ShareCard from './ShareCard';
import WeeklyStatsCard from './templates/WeeklyStatsCard';
import StreakCard from './templates/StreakCard';
import NylaMirrorCard from './templates/NylaMirrorCard';
import ChallengeCard from './templates/ChallengeCard';
import MonthlyReflectionCard from './templates/MonthlyReflectionCard';
import MultiChallengeCard from './templates/MultiChallengeCard';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  data: ShareData;
  displayName?: string;
}

type Screen = 'picker' | 'preview';

function renderTemplate(data: ShareData, accentColor: string) {
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
          accentColor={accentColor}
        />
      );
    case 'streak':
      return (
        <StreakCard
          streak={data.streak}
          completionRate={data.completionRate}
          totalDone={data.totalDone}
          accentColor={accentColor}
        />
      );
    case 'nyla_mirror':
      return (
        <NylaMirrorCard
          title={data.title}
          strengths={data.strengths}
          blindSpots={data.blindSpots}
          primaryTag={data.primaryTag}
          accentColor={accentColor}
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
          daysLeft={data.daysLeft}
          dailyTarget={data.dailyTarget}
          remaining={data.remaining}
          deadline={data.deadline}
          tag={data.tag}
          tagIcon={data.tagIcon}
          accentColor={accentColor}
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
          accentColor={accentColor}
        />
      );
    case 'multi_challenge':
      return <MultiChallengeCard challenges={data.challenges} accentColor={accentColor} />;
  }
}

export default function ShareModal({ visible, onClose, data, displayName }: ShareModalProps) {
  const { theme } = useTheme();
  const [format, setFormat] = useState<ShareFormat>('9:16');
  const [screen, setScreen] = useState<Screen>('picker');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [gradientBg, setGradientBg] = useState<GradientBg | null>(null);
  const [busy, setBusy] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  const goToPreview = (image: string | null, gradient: GradientBg | null) => {
    setBackgroundImage(image);
    setGradientBg(gradient);
    setScreen('preview');
  };

  const goBackToPicker = () => {
    setScreen('picker');
    setBackgroundImage(null);
    setGradientBg(null);
  };

  const handleFullClose = () => {
    setScreen('picker');
    setBackgroundImage(null);
    setGradientBg(null);
    onClose();
  };

  const requestPermission = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Needed',
          'Displyn needs camera access so you can take a photo for your share card. You can enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }
      return true;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Access Needed',
        'Displyn needs gallery access so you can pick a photo for your share card. You can enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const handleCamera = async () => {
    const granted = await requestPermission('camera');
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: format === '1:1' ? [1, 1] : [9, 16],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      goToPreview(result.assets[0].uri, null);
    }
  };

  const handleGallery = async () => {
    const granted = await requestPermission('gallery');
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: format === '1:1' ? [1, 1] : [9, 16],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      goToPreview(result.assets[0].uri, null);
    }
  };

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
      Alert.alert('Gallery Access Needed', 'Displyn needs gallery access to save your share card.', [{ text: 'OK' }]);
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
    <Modal visible={visible} animationType="slide" transparent={screen === 'picker'} onRequestClose={handleFullClose}>
      {screen === 'picker' ? (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Share Insight</Text>

            <View style={styles.formatRow}>
              <Text style={styles.formatLabel}>Format</Text>
              <View style={styles.formatToggle}>
                {(['1:1', '9:16'] as ShareFormat[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.formatBtn, format === f && styles.formatBtnActive]}
                    onPress={() => setFormat(f)}
                  >
                    <Text style={[styles.formatBtnText, format === f && styles.formatBtnTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Background</Text>

            <TouchableOpacity style={styles.optionRow} onPress={handleCamera}>
              <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
              <Text style={styles.optionText}>Take Photo</Text>
              <Ionicons name="chevron-forward" size={18} color="#55555F" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleGallery}>
              <Ionicons name="image-outline" size={22} color="#FFFFFF" />
              <Text style={styles.optionText}>Choose from Gallery</Text>
              <Ionicons name="chevron-forward" size={18} color="#55555F" />
            </TouchableOpacity>

            <Text style={styles.gradientLabel}>Solid Backgrounds</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradientScroll} contentContainerStyle={styles.gradientScrollContent}>
              {GRADIENT_BACKGROUNDS.map((bg) => (
                <TouchableOpacity key={bg.id} onPress={() => goToPreview(null, bg)} activeOpacity={0.7}>
                  <LinearGradient
                    colors={bg.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientSwatch}
                  />
                  <Text style={styles.gradientName}>{bg.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleFullClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={goBackToPicker} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Preview</Text>
            <TouchableOpacity onPress={handleFullClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.previewWrap}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={styles.viewShot}
            >
              <ShareCard format={format} backgroundImage={backgroundImage} gradientBg={gradientBg} displayName={displayName}>
                {renderTemplate(data, theme.primary)}
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
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#141419',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#55555F', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  formatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  formatLabel: { color: '#8F8F9D', fontSize: 14 },
  formatToggle: { flexDirection: 'row', backgroundColor: '#1E1E26', borderRadius: 10, padding: 3 },
  formatBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  formatBtnActive: { backgroundColor: '#7C5CFC' },
  formatBtnText: { color: '#8F8F9D', fontSize: 13, fontWeight: '600' },
  formatBtnTextActive: { color: '#FFFFFF' },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E26',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  optionText: { color: '#FFFFFF', fontSize: 14, flex: 1 },
  gradientLabel: { color: '#8F8F9D', fontSize: 13, marginTop: 14, marginBottom: 10 },
  gradientScroll: { marginBottom: 20 },
  gradientScrollContent: { gap: 12 },
  gradientSwatch: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, borderColor: '#1E1E26' },
  gradientName: { color: '#55555F', fontSize: 10, textAlign: 'center', marginTop: 4 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#8F8F9D', fontSize: 15, fontWeight: '500' },

  previewContainer: { flex: 1, backgroundColor: '#0B0B0F' },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  previewHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
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
