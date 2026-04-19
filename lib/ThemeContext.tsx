import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, ThemeColors, ThemeMode } from './theme';
import { getAccentPreset } from './accentColors';
import { supabase } from './supabase';

const ACCENT_STORAGE_KEY = 'displyn_accent_color';

interface ThemeContextType {
  mode: ThemeMode;
  preference: ThemeMode | 'system';
  theme: ThemeColors;
  setMode: (mode: ThemeMode | 'system') => void;
  isDark: boolean;
  accentKey: string;
  setAccentColor: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  preference: 'system',
  theme: colors.dark,
  setMode: () => {},
  isDark: true,
  accentKey: 'purple',
  setAccentColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [userPreference, setUserPreference] = useState<ThemeMode | 'system'>('system');
  const [accentKey, setAccentKey] = useState('purple');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
        if (stored) setAccentKey(stored);
      } catch {}

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('accent_color')
            .eq('id', user.id)
            .single();
          if (data?.accent_color) {
            setAccentKey(data.accent_color);
            await AsyncStorage.setItem(ACCENT_STORAGE_KEY, data.accent_color);
          }
        }
      } catch {}
    })();
  }, []);

  const setAccentColor = useCallback(async (key: string) => {
    setAccentKey(key);
    try { await AsyncStorage.setItem(ACCENT_STORAGE_KEY, key); } catch {}
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ accent_color: key }).eq('id', user.id);
      }
    } catch {}
  }, []);

  const mode: ThemeMode =
    userPreference === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : userPreference;

  const theme = useMemo(() => {
    const accent = getAccentPreset(accentKey);
    return { ...colors[mode], ...accent[mode] };
  }, [mode, accentKey]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preference: userPreference,
        theme,
        setMode: setUserPreference,
        isDark: mode === 'dark',
        accentKey,
        setAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
