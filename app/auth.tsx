import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

const { width, height } = Dimensions.get('window');
const BRAND = '#6B6DD8';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      toast.warning('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          toast.warning('Missing name', 'Please enter your display name.');
          setLoading(false);
          return;
        }
        if (!ageConfirmed) {
          toast.warning('Age confirmation required', 'Please confirm you are 13 or older.');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        // Navigation handled automatically by _layout.tsx auth state change
        toast.success('Account created!', 'Welcome to Displyn 🎉');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Navigation handled automatically by _layout.tsx auth state change
        toast.success('Welcome back!', 'Great to see you again 👋');
      }
    } catch (e: any) {
      toast.error('Could not sign in', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full screen background */}
      <Image
        source={require('../assets/images/login-bg.jpg')}
        style={s.bg}
        resizeMode="cover"
      />

      {/* KeyboardAvoidingView wraps everything */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* ScrollView so card slides up when keyboard opens */}
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Spacer — shows Nyla + background above card */}
          <View style={{ height: height * 0.38 }} />

          {/* Glassmorphic card */}
          <Animated.View
            style={[s.glass, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
          >
            <Text style={s.heading}>
              {isSignUp ? 'Create Account' : 'Welcome back'}
            </Text>
            <Text style={s.subheading}>
              {isSignUp
                ? 'Join Displyn and start your journey'
                : 'Sign in to continue with Nyla'}
            </Text>

            {/* Name field — sign up only */}
            {isSignUp && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Your Name</Text>
                <View style={s.inputRow}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="rgba(255,255,255,0.45)"
                    style={s.icon}
                  />
                  <TextInput
                    ref={nameRef}
                    style={s.input}
                    placeholder="Display name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                    onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email</Text>
              <View style={s.inputRow}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color="rgba(255,255,255,0.45)"
                  style={s.icon}
                />
                <TextInput
                  ref={emailRef}
                  style={s.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={s.inputRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="rgba(255,255,255,0.45)"
                  style={s.icon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[s.input, { flex: 1 }]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="rgba(255,255,255,0.45)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            {!isSignUp && (
              <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 14 }}>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Age + Privacy for sign up */}
            {isSignUp && (
              <TouchableOpacity
                style={s.checkRow}
                onPress={() => setAgeConfirmed(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[s.checkbox, ageConfirmed && s.checkboxActive]}>
                  {ageConfirmed && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={s.checkText}>
                  I am 13 or older and agree to the{' '}
                  <Text
                    style={s.checkLink}
                    onPress={() => router.push('/privacy-policy')}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={[s.signInBtn, loading && { opacity: 0.7 }]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.signInText}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* OR divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social */}
            <View style={s.socialRow}>
              {/* TODO: Wire Apple after Apple Developer account is active */}
              <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={s.socialBtnText}>Apple</Text>
              </TouchableOpacity>
              {/* TODO: Wire Google */}
              <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                <Ionicons name="logo-google" size={18} color="#fff" />
                <Text style={s.socialBtnText}>Google</Text>
              </TouchableOpacity>
            </View>

            {/* Switch between log in / sign up */}
            <TouchableOpacity
              style={s.switchRow}
              onPress={() => {
                setIsSignUp(v => !v);
                setEmail('');
                setPassword('');
                setDisplayName('');
              }}
            >
              <Text style={s.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={s.switchLink}>
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10091E' },
  bg: { position: 'absolute', top: 0, left: 0, width, height },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  glass: {
    backgroundColor: 'rgba(18, 14, 45, 0.82)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    height: 50,
    paddingHorizontal: 14,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15, height: 50 },
  forgotText: { color: BRAND, fontSize: 13, fontWeight: '500' },
  signInBtn: {
    backgroundColor: BRAND,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  socialBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  switchLink: { color: BRAND, fontWeight: '700' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  checkText: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 18,
  },
  checkLink: {
    color: BRAND,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});