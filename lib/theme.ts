export const colors = {
    dark: {
      // Backgrounds
      bg: '#0B0B0F',
      surface: '#141419',
      surfaceBorder: '#1E1E26',
      elevated: '#1C1C24',
  
      // Text
      textPrimary: '#FFFFFF',
      textSecondary: '#8F8F9D',
      textTertiary: '#55555F',
  
      // Primary
      primary: '#7C5CFC',
      primaryMuted: '#7C5CFC20',
      primaryBorder: '#7C5CFC50',
  
      // Status
      success: '#34D399',
      successMuted: '#34D39920',
      error: '#F87171',
      errorMuted: '#F8717120',
      warning: '#FBBF24',
      warningMuted: '#FBBF2420',
      orange: '#FB923C',
  
      // Tab bar
      tabBar: '#0B0B0F',
      tabBarBorder: '#1E1E26',
      tabActive: '#7C5CFC',
      tabInactive: '#55555F',
  
      // Components
      inputBg: '#141419',
      inputBorder: '#1E1E26',
      cardBg: '#141419',
      cardBorder: '#1E1E26',
      divider: '#1E1E26',
      overlay: '#0B0B0F90',
  
      // Misc
      avatarBg: '#7C5CFC',
      streakFire: '#FB923C',
      momentumBarEmpty: '#1E1E26',
      doneButton: '#7C5CFC',
    },
  
    light: {
      // Backgrounds
      bg: '#F5F5F7',
      surface: '#FFFFFF',
      surfaceBorder: '#E5E5EA',
      elevated: '#FFFFFF',
  
      // Text
      textPrimary: '#1C1C1E',
      textSecondary: '#6B6B7B',
      textTertiary: '#AEAEB2',
  
      // Primary
      primary: '#6D4AE8',
      primaryMuted: '#6D4AE815',
      primaryBorder: '#6D4AE840',
  
      // Status
      success: '#22B07D',
      successMuted: '#22B07D15',
      error: '#E5484D',
      errorMuted: '#E5484D15',
      warning: '#E5A000',
      warningMuted: '#E5A00015',
      orange: '#ED7A3B',
  
      // Tab bar
      tabBar: '#FFFFFF',
      tabBarBorder: '#E5E5EA',
      tabActive: '#6D4AE8',
      tabInactive: '#AEAEB2',
  
      // Components
      inputBg: '#FFFFFF',
      inputBorder: '#E5E5EA',
      cardBg: '#FFFFFF',
      cardBorder: '#E5E5EA',
      divider: '#E5E5EA',
      overlay: '#00000040',
  
      // Misc
      avatarBg: '#6D4AE8',
      streakFire: '#ED7A3B',
      momentumBarEmpty: '#E5E5EA',
      doneButton: '#6D4AE8',
    },
  };
  
  // Tag colors (same in both themes — brand colors)
  export const TAG_THEME = {
    'Work & Career': { color: '#3B82F6', icon: '💼' },
    'Health & Fitness': { color: '#34D399', icon: '💪' },
    'Learning & Skill Building': { color: '#A78BFA', icon: '📚' },
    'Finance & Money': { color: '#FBBF24', icon: '💰' },
    'Personal Growth': { color: '#EC4899', icon: '🌱' },
    'Relationships & Social': { color: '#FB923C', icon: '👥' },
    'Admin & Life Maintenance': { color: '#6B7280', icon: '🔧' },
    'Self-Care': { color: '#F472B6', icon: '🧴' },
    'Creative & Expression': { color: '#14B8A6', icon: '🎨' },
    'Spiritual / Purpose': { color: '#8B5CF6', icon: '🧘' },
    'Lifestyle & Leisure': { color: '#06B6D4', icon: '🎯' },
  };
  
  export type ThemeMode = 'dark' | 'light';
  export type ThemeColors = typeof colors.dark;