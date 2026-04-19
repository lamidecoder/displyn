import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

const NYLA = require('../assets/icons/nyla-avatar.png');
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 40;

// Card positioned below the trigger icon: right-aligned, just beneath the greeting row
const CARD_TOP = 148;
const CARD_RIGHT = 20;

// To simulate top-right transformOrigin with RN's center-based scaling,
// we offset by half the card dimensions so it scales from its top-right corner.
const ORIGIN_X = CARD_WIDTH / 2;
const ORIGIN_Y = -65; // estimated half card height, negative = shift up toward top edge

interface Props {
  visible: boolean;
  loading: boolean;
  message: string | null;
  onDismiss: () => void;
  isDark: boolean;
  theme: any;
}

export default function NylaFocusOverlay({ visible, loading, message, onDismiss, isDark, theme }: Props) {
  const [mounted, setMounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dimOpacity = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const breatheLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(0);
      opacity.setValue(0);
      dimOpacity.setValue(0);
      breathe.setValue(1);

      Animated.parallel([
        Animated.spring(progress, { toValue: 1, damping: 14, stiffness: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dimOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        breatheLoop.current = Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, { toValue: 1.005, duration: 1500, useNativeDriver: true }),
            Animated.timing(breathe, { toValue: 0.995, duration: 1500, useNativeDriver: true }),
          ])
        );
        breatheLoop.current.start();
      });
    } else if (mounted) {
      breatheLoop.current?.stop();
      breathe.setValue(1);

      Animated.parallel([
        Animated.timing(progress, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dimOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const dismissColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  const textColor = isDark ? '#FFFFFF' : '#1C1C1E';
  const secondaryColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  // Derive scale and translate from the single progress value
  // so scale and position are perfectly in sync.
  const scale = Animated.multiply(progress, breathe);

  // Shift the card so it scales from its top-right corner:
  // When scale=0 the card's top-right corner stays pinned,
  // when scale=1 the translate is 0 (card in normal position).
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ORIGIN_X, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ORIGIN_Y, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.dimBackdrop, { opacity: dimOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity,
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
            borderColor,
          },
        ]}
      >
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={50}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Image source={NYLA} style={styles.avatar} resizeMode="contain" />
              <Text style={[styles.label, { color: secondaryColor }]}>Nyla's Focus</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeIcon, { color: dismissColor }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading || !message ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={secondaryColor} />
              <Text style={[styles.loadingText, { color: secondaryColor }]}>
                Nyla is reading your tasks...
              </Text>
            </View>
          ) : (
            <Text style={[styles.messageText, { color: textColor }]} numberOfLines={4}>
              {message}
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dimBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardWrapper: {
    position: 'absolute',
    top: CARD_TOP,
    right: CARD_RIGHT,
    width: CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
