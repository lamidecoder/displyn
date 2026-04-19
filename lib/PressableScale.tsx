import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp } from 'react-native';

interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  scaleValue?: number;
  haptic?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy';
  disabled?: boolean;
  delayLongPress?: number;
}

export default function PressableScale({
  onPress,
  onLongPress,
  style,
  children,
  scaleValue = 0.97,
  haptic = true,
  hapticStyle = 'light',
  disabled = false,
  delayLongPress,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleValue]);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) {
      const impact =
        hapticStyle === 'heavy'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : hapticStyle === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(impact).catch(() => {});
    }
    onPress?.();
  }, [disabled, haptic, hapticStyle, onPress]);

  // Extract flex from the style so Pressable itself fills the correct space
  const flatStyle = style ? (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style) : {};
  const { flex, flexGrow, flexShrink, flexBasis, alignSelf, width, margin, marginLeft, marginRight, marginTop, marginBottom, marginHorizontal, marginVertical, ...innerStyle } = flatStyle as any;
  const outerStyle: any = {};
  if (flex !== undefined) outerStyle.flex = flex;
  if (flexGrow !== undefined) outerStyle.flexGrow = flexGrow;
  if (flexShrink !== undefined) outerStyle.flexShrink = flexShrink;
  if (flexBasis !== undefined) outerStyle.flexBasis = flexBasis;
  if (alignSelf !== undefined) outerStyle.alignSelf = alignSelf;
  if (width !== undefined) outerStyle.width = width;
  if (margin !== undefined) outerStyle.margin = margin;
  if (marginLeft !== undefined) outerStyle.marginLeft = marginLeft;
  if (marginRight !== undefined) outerStyle.marginRight = marginRight;
  if (marginTop !== undefined) outerStyle.marginTop = marginTop;
  if (marginBottom !== undefined) outerStyle.marginBottom = marginBottom;
  if (marginHorizontal !== undefined) outerStyle.marginHorizontal = marginHorizontal;
  if (marginVertical !== undefined) outerStyle.marginVertical = marginVertical;

  return (
    <Pressable
      onPressIn={animateIn}
      onPressOut={animateOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      style={Object.keys(outerStyle).length > 0 ? outerStyle : undefined}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
