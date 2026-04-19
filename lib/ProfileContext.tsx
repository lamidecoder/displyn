import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AppProfile {
  id: string;
  display_name: string | null;
  app_mode: string | null;
  focus_tags: string[] | null;
  struggle_type: string | null;
  notification_tone: string | null;
  accent_color: string | null;
  timezone: string | null;
  avatar_emoji: string | null;
  badges: string[] | null;
  push_token: string | null;
  [key: string]: any;
}

interface ProfileContextValue {
  profile: AppProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProfile(null); setLoading(false); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) { setProfile(null); } else { setProfile(data); }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadProfile();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: loadProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
