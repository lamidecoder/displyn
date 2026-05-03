import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';

export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const accessToken = params.access_token as string;
      const refreshToken = params.refresh_token as string;

      if (accessToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
      } else {
        await new Promise(r => setTimeout(r, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/auth');
          return;
        }
      }
    } catch (e) {
      router.replace('/auth');
    }
  };

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#7072DD" />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});