import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useTheme } from '../lib/ThemeContext';
import * as Linking from 'expo-linking';

export default function ResetPassword() {
  const { theme } = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    setupSession();
  }, []);

  const setupSession = async () => {
    try {
      // Try to get tokens from URL params first (deep link)
      const url = await Linking.getInitialURL();
      if (url) {
        // Extract tokens from hash fragment
        const hash = url.includes('#') ? url.split('#')[1] : '';
        const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
        const searchStr = hash || query || '';
        const p = new URLSearchParams(searchStr);
        const accessToken = p.get('access_token');
        const refreshToken = p.get('refresh_token');
        const type = p.get('type');

        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (!error) {
            setSessionReady(true);
            return;
          }
        }
      }

      // Fallback: check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        toast.error('Link expired', 'Please request a new password reset link.');
        router.replace('/auth');
      }
    } catch (e) {
      toast.error('Link expired', 'Please request a new password reset link.');
      router.replace('/auth');
    }
  };

  const handleReset = async () => {
    if (!password.trim() || password.length < 6) {
      toast.warning('Too short', 'Password must be at least 6 characters.'); return;
    }
    if (password !== confirm) {
      toast.warning('No match', 'Passwords do not match.'); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated!', 'Sign in with your new password.');
      await supabase.auth.signOut();
      router.replace('/auth');
    } catch (e: any) {
      toast.error('Something went wrong', e.message);
    } finally { setLoading(false); }
  };

  if (!sessionReady) return (
    <View style={[s.c, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[s.c, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={[s.title, { color: theme.textPrimary }]}>Set New Password</Text>
        <Text style={[s.sub, { color: theme.textSecondary }]}>Choose a strong new password for your Displyn account.</Text>
        <TextInput
          style={[s.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
          placeholder="New password (min 6 chars)"
          placeholderTextColor={theme.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
        />
        <TextInput
          style={[s.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
          placeholder="Confirm new password"
          placeholderTextColor={theme.textTertiary}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Update Password</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 10, letterSpacing: -0.5 },
  sub: { fontSize: 14, marginBottom: 32, lineHeight: 22 },
  input: { borderRadius: 14, borderWidth: 1, padding: 16, fontSize: 16, marginBottom: 14 },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});