import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const BRAND = '#7072DD';

const SLIDES = [
  {
    id: '1',
    image: require('../assets/images/intro-slide-1.jpg'),
    headline: 'Most days, intention beats action.',
    subtext: 'You meant to. You didn\'t. The gap quietly widens.',
    textPosition: 'top-left',
    hasCTA: false,
  },
  {
    id: '2',
    image: require('../assets/images/intro-slide-2.jpg'),
    headline: 'What if you saw what you actually do?',
    subtext: 'Not your plans. Your patterns. The truth your behaviour tells.',
    textPosition: 'top-left',
    hasCTA: false,
  },
  {
    id: '3',
    image: require('../assets/images/intro-slide-3.jpg'),
    headline: 'Meet Nyla.',
    subtext: 'Your honest companion. She tracks what you do, not what you say, and helps you close the gap.',
    textPosition: 'top-center',
    hasCTA: true,
  },
];

export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleStart = async () => {
    await AsyncStorage.setItem('displyn_intro_seen', 'true');
    router.replace('/auth');
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={s.slide}>
            {/* Full screen background image */}
            <Image source={item.image} style={s.bg} resizeMode="cover" />
            {/* Dark overlay */}
            <View style={s.overlay} />

            {/* Text content */}
            <View
              style={[
                s.textBlock,
                { paddingTop: insets.top + 32 },
                item.textPosition === 'top-center' && s.textCenter,
              ]}
            >
              <Image
                source={require('../assets/icons/displyn-mark-solid-white.svg')}
                style={{ width: 32, height: 32, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text
                style={[
                  s.headline,
                  item.textPosition === 'top-center' && s.headlineCenter,
                ]}
              >
                {item.headline}
              </Text>
              <Text
                style={[
                  s.subtext,
                  item.textPosition === 'top-center' && s.subtextCenter,
                ]}
              >
                {item.subtext}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === currentIndex && s.dotActive,
              ]}
            />
          ))}
        </View>

        {/* CTA / Next */}
        {isLast ? (
          <TouchableOpacity style={s.ctaBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={s.ctaBtnText}>Let's begin</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.navRow}>
            <TouchableOpacity onPress={handleStart}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={s.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080812' },
  slide: { width, height },
  bg: { position: 'absolute', top: 0, left: 0, width, height },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(6,6,18,0.38)',
  },
  textBlock: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 28,
  },
  textCenter: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  headlineCenter: {
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtextCenter: {
    textAlign: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 20, backgroundColor: '#fff',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },
  nextBtn: {
    backgroundColor: BRAND,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: BRAND,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ctaBtn: {
    backgroundColor: BRAND,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});