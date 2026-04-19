import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const BRAND = '#7072DD';
const BG = '#0A0A12';
const NYLA = require('../assets/icons/nyla-avatar.png');

const SLIDES = [
  {
    headline: "There's a gap between what you plan and what you do.",
    subhead: "Most apps track your intentions. Displyn tracks what actually happened.",
  },
  {
    headline: "See yourself honestly.",
    subhead: "Displyn reflects what you're really doing — not what you wish you were. That's where change begins.",
  },
  {
    headline: "Meet Nyla.",
    subhead: "Your honest companion. She notices what you notice, remembers what matters, and tells you the truth — kindly.",
    cta: true,
  },
];

const INTRO_KEY = 'displyn_intro_seen';
const AUTO_ADVANCE_MS = 4000;

export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Nyla breathing
  const breathe = useRef(new Animated.Value(1)).current;
  const nylaFade = useRef(new Animated.Value(0)).current;

  // Progress bar
  const progress = useRef(new Animated.Value(0)).current;
  const progressLoop = useRef<any>(null);

  const goToLogin = useCallback(async () => {
    await AsyncStorage.setItem(INTRO_KEY, 'true');
    router.replace('/auth');
  }, []);

  const goToSlide = useCallback((next: number, direction: 'left' | 'right' = 'left') => {
    if (next < 0 || next >= SLIDES.length) return;
    setPaused(true);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  // Auto advance
  useEffect(() => {
    if (paused || slide === SLIDES.length - 1) return;
    const t = setTimeout(() => goToSlide(slide + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [slide, paused, goToSlide]);

  // Nyla entrance
  useEffect(() => {
    Animated.timing(nylaFade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.04, duration: 2200, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1.0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 40,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -40) {
          setPaused(true);
          setSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
        } else if (gs.dx > 40) {
          setPaused(true);
          setSlide(prev => Math.max(prev - 1, 0));
        }
      },
    })
  ).current;

  const handleTap = (e: any) => {
    const x = e.nativeEvent.locationX;
    setPaused(true);
    if (slide === SLIDES.length - 1) return;
    if (x > width / 2) {
      setSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
    } else {
      setSlide(prev => Math.max(prev - 1, 0));
    }
  };

  const current = SLIDES[slide];

  return (
    <View style={s.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Glow */}
      <View style={s.glowWrap}>
        <View style={s.glow} />
      </View>

      {/* Skip */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={goToLogin} style={s.skipBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Dot indicators */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === slide ? s.dotActive : s.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Tap zone */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTap}
        style={s.tapZone}
      >
        {/* Nyla */}
        <Animated.View style={[s.nylaWrap, { opacity: nylaFade, transform: [{ scale: breathe }] }]}>
          <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        </Animated.View>

        {/* Text */}
        <Animated.View style={[s.textWrap, { opacity: fadeAnim }]}>
          <Text style={s.headline}>{current.headline}</Text>
          <Text style={s.subhead}>{current.subhead}</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* CTA on last slide */}
      <View style={[s.bottomArea, { paddingBottom: insets.bottom + 24 }]}>
        {current.cta ? (
          <TouchableOpacity style={s.ctaBtn} onPress={goToLogin} activeOpacity={0.85}>
            <Text style={s.ctaText}>Let's begin</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.nextBtn} onPress={() => { setPaused(true); setSlide(s => s + 1); }}>
            <Text style={s.nextText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  glowWrap: {
    position: 'absolute',
    top: height * 0.08,
    alignSelf: 'center',
    width: width * 0.7,
    height: width * 0.7,
  },
  glow: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.35,
    backgroundColor: BRAND,
    opacity: 0.18,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 24, backgroundColor: BRAND },
  dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  tapZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  nylaWrap: { alignItems: 'center', marginBottom: 40 },
  nyla: { width: width * 0.42, height: width * 0.42 },
  textWrap: { alignItems: 'center' },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: 16,
  },
  subhead: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomArea: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    height: 56,
    backgroundColor: BRAND,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  nextBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  nextText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
});
