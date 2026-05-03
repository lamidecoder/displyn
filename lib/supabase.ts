import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://kskvwbamxvurxjryfqkn.supabase.co';
const supabaseAnonKey = 'sb_publishable_j-F7EMc-ekc5OTxSP9Kgvg_t9lrOqcd';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});