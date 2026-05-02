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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const BRAND = '#6B6DD8';

const GOALS = ['Build better habits', 'Be more productive', 'Improve my health', 'Stay accountable', 'Track my progress'];
const AGE_RANGES = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+'];
const OCCUPATIONS = ['Student', 'Employee', 'Freelancer', 'Entrepreneur', 'Parent', 'Other'];

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [occupation, setOccupation] = useState('');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [isForgot, setIsForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}
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
    if (isSignUp && !displayName.trim()) {
      toast.warning('Missing name', 'Please enter your display name.');
      return;
    }
    if (isSignUp && !ageConfirmed) {
      toast.warning('Age required', 'Please confirm you are 13 or older.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              primary_goal: selectedGoal,
              age_range: ageRange,
              occupation,
              timezone,
            },
          },
        });
        if (error) throw error;
        toast.success('Welcome to Displyn!', 'Your account is ready.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(isSignUp ? 'Sign up failed' : 'Sign in failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.warning('Enter your email', 'Type your email address above first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setForgotSent(true);
      toast.success('Email sent!', 'Check your inbox for the reset link.');
    } catch (e: any) {
      toast.error('Could not send email', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);

      const redirectTo = makeRedirectUri({ path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        toast.error('Google sign-in failed', error?.message || 'Could not get sign-in URL.');
        setGoogleLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const returnUrl = result.url;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Check hash fragment (#access_token=...)
        if (returnUrl.includes('#')) {
          const p = new URLSearchParams(returnUrl.split('#')[1]);
          accessToken = p.get('access_token');
          refreshToken = p.get('refresh_token');
        }

        // Check query string (?access_token=...)
        if (!accessToken && returnUrl.includes('?')) {
          const p = new URLSearchParams(returnUrl.split('?')[1]?.split('#')[0] || '');
          accessToken = p.get('access_token');
          refreshToken = p.get('refresh_token');
        }

        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (sessionError) {
            toast.error('Google sign-in failed', sessionError.message);
            setGoogleLoading(false);
          }
          // onAuthStateChange in _layout.tsx handles routing
        } else {
          // Wait and check if Supabase set session automatically
          await new Promise(r => setTimeout(r, 1000));
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error('Google sign-in failed', 'Could not complete sign in. Please try again.');
            setGoogleLoading(false);
          }
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleLoading(false);
      } else {
        setGoogleLoading(false);
      }
    } catch (e: any) {
      toast.error('Google sign-in failed', e.message);
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const AppleAuth = await import('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        toast.error('Apple sign-in failed', 'No identity token received.');
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      if (credential.fullName?.givenName) {
        const displayName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ');
        await supabase.auth.updateUser({ data: { display_name: displayName } });
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      toast.error('Apple sign-in failed', e.message);
    }
  };

  const resetForm = () => {
    setIsSignUp(v => !v);
    setEmail(''); setPassword(''); setDisplayName('');
    setSelectedGoal(''); setAgeRange(''); setOccupation('');
    setAgeConfirmed(false); setIsForgot(false); setForgotSent(false);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={require('../assets/images/login-bg.jpg')} style={s.bg} resizeMode="cover" />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ height: height * 0.38 }} />

          <Animated.View style={[s.glass, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <Text style={s.heading}>{isSignUp ? 'Create Account' : 'Welcome back'}</Text>
            <Text style={s.subheading}>
              {isSignUp ? 'Join Displyn and meet Nyla' : 'Sign in to continue with Nyla'}
            </Text>

            {/* Display Name — signup only */}
            {isSignUp && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Display Name</Text>
                <View style={s.inputRow}>
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.45)" style={s.icon} />
                  <TextInput
                    style={s.input}
                    placeholder="What should Nyla call you?"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email</Text>
              <View style={s.inputRow}>
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.45)" style={s.icon} />
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
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={s.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.45)" style={s.icon} />
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
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Goal chips — signup only */}
            {isSignUp && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Primary Goal (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {GOALS.map(goal => (
                      <TouchableOpacity
                        key={goal}
                        style={[s.goalChip, selectedGoal === goal && s.goalChipActive]}
                        onPress={() => setSelectedGoal(selectedGoal === goal ? '' : goal)}
                      >
                        <Text style={[s.goalChipText, selectedGoal === goal && s.goalChipTextActive]}>{goal}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Age range — signup only */}
            {isSignUp && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Age Range (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {AGE_RANGES.map(age => (
                      <TouchableOpacity
                        key={age}
                        style={[s.goalChip, ageRange === age && s.goalChipActive]}
                        onPress={() => setAgeRange(ageRange === age ? '' : age)}
                      >
                        <Text style={[s.goalChipText, ageRange === age && s.goalChipTextActive]}>{age}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Occupation — signup only */}
            {isSignUp && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Occupation (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {OCCUPATIONS.map(occ => (
                      <TouchableOpacity
                        key={occ}
                        style={[s.goalChip, occupation === occ && s.goalChipActive]}
                        onPress={() => setOccupation(occupation === occ ? '' : occ)}
                      >
                        <Text style={[s.goalChipText, occupation === occ && s.goalChipTextActive]}>{occ}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Forgot password */}
            {!isSignUp && (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 }}
                onPress={handleForgotPassword}
              >
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Age confirmation — signup only */}
            {isSignUp && (
              <TouchableOpacity style={s.checkRow} onPress={() => setAgeConfirmed(v => !v)} activeOpacity={0.8}>
                <View style={[s.checkbox, ageConfirmed && s.checkboxActive]}>
                  {ageConfirmed && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={s.checkText}>
                  I am 13 or older and agree to the{' '}
                  <Text style={s.checkLink} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>
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
                  <Text style={s.signInText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={s.socialRow}>
              <TouchableOpacity
                style={[s.socialBtn, Platform.OS !== 'ios' && { opacity: 0.4 }]}
                onPress={Platform.OS === 'ios' ? handleAppleSignIn : undefined}
                disabled={Platform.OS !== 'ios'}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={s.socialBtnText}>Apple</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.socialBtn, googleLoading && { opacity: 0.6 }]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.8}
              >
                {googleLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="logo-google" size={18} color="#fff" /><Text style={s.socialBtnText}>Google</Text></>
                }
              </TouchableOpacity>
            </View>

            {/* Switch */}
            <TouchableOpacity style={s.switchRow} onPress={resetForm}>
              <Text style={s.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={s.switchLink}>{isSignUp ? 'Log In' : 'Sign Up'}</Text>
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
  scrollContent: { paddingHorizontal: 20 },
  glass: {
    backgroundColor: 'rgba(18,14,45,0.82)',
    borderRadius: 28, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)', padding: 24,
    shadowColor: '#000', shadowOpacity: 0.35,
    shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 14,
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: -0.4, marginBottom: 4 },
  subheading: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 20 },
  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    height: 50, paddingHorizontal: 14,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, height: 50 },
  goalChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  goalChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  goalChipText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
  goalChipTextActive: { color: '#fff' },
  forgotText: { color: BRAND, fontSize: 13, fontWeight: '500' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: BRAND, borderColor: BRAND },
  checkText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },
  checkLink: { color: BRAND, fontWeight: '600', textDecorationLine: 'underline' },
  signInBtn: {
    backgroundColor: BRAND, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BRAND, shadowOpacity: 0.55, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  socialBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  socialBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  switchLink: { color: BRAND, fontWeight: '700' },
});