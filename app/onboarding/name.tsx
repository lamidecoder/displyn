import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { ProgressDots } from './index';

const NYLA = require('../../assets/icons/nyla-avatar.png');
const BG_NAME = require('../../assets/images/onboarding-bg-2.jpg');


export default function NameScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme);
  const [name, setName] = useState('');

  const canContinue = name.trim().length > 0;

  return (
    <View style={s.root}>
      <Image source={BG_NAME} style={s.bgImg} resizeMode="cover" />
      <View style={s.overlay} />
      <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressDots current={1} theme={theme} />

      <View style={s.centerContent}>
        <Image source={NYLA} style={s.nyla} resizeMode="contain" />
        <Text style={s.title}>What should I call you?</Text>

        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Your first name"
          placeholderTextColor={theme.textTertiary}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => canContinue && router.push({ pathname: '/onboarding/mode', params: { displayName: name.trim() } })}
        />
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary, opacity: canContinue ? 1 : 0.4 }]}
          activeOpacity={0.8}
          disabled={!canContinue}
          onPress={() => router.push({ pathname: '/onboarding/mode', params: { displayName: name.trim() } })}
        >
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0A0A12' },
    bgImg: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,20,0.5)' },
    container: { flex: 1, paddingHorizontal: 24 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nyla: { width: 90, height: 90, marginBottom: 24, backgroundColor: 'transparent' },
    title: {
      fontSize: 26, fontWeight: '800', color: '#FFFFFF',
      textAlign: 'center', marginBottom: 24,
    },
    input: {
      width: '100%', height: 56, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 20, fontSize: 18, color: '#FFFFFF',
      textAlign: 'center', fontWeight: '600',
    },
    btn: {
      height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });