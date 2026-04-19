import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareFormat, GradientBg } from './types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING_H = 24;
const PREVIEW_WIDTH = SCREEN_WIDTH - CARD_PADDING_H * 2;

const ASPECT_RATIOS: Record<ShareFormat, number> = {
  '1:1': 1,
  '9:16': 16 / 9,
};

interface ShareCardProps {
  format: ShareFormat;
  backgroundImage?: string | null;
  gradientBg?: GradientBg | null;
  displayName?: string;
  children: React.ReactNode;
}

export default function ShareCard({ format, backgroundImage, gradientBg, displayName, children }: ShareCardProps) {
  const aspect = ASPECT_RATIOS[format];
  const cardWidth = PREVIEW_WIDTH;
  const cardHeight = cardWidth * aspect;

  return (
    <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
      {backgroundImage ? (
        <>
          <Image source={{ uri: backgroundImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(11,11,15,0.55)', 'rgba(11,11,15,0.85)']}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      ) : gradientBg ? (
        <LinearGradient colors={gradientBg.colors} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0B0B0F' }]} />
      )}

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        {displayName ? <Text style={styles.username}>@{displayName}</Text> : null}
        <Text style={styles.poweredBy}>Powered by Nyla</Text>
        <Text style={styles.brandName}>DISPLYN</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 80,
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  poweredBy: {
    color: '#8F8F9D',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  brandName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
});
