export interface AccentPreset {
  key: string;
  label: string;
  dark: {
    primary: string;
    primaryMuted: string;
    primaryBorder: string;
    tabActive: string;
    avatarBg: string;
    doneButton: string;
  };
  light: {
    primary: string;
    primaryMuted: string;
    primaryBorder: string;
    tabActive: string;
    avatarBg: string;
    doneButton: string;
  };
}

function makePreset(
  key: string,
  label: string,
  darkPrimary: string,
  lightPrimary: string,
): AccentPreset {
  return {
    key,
    label,
    dark: {
      primary: darkPrimary,
      primaryMuted: darkPrimary + '20',
      primaryBorder: darkPrimary + '50',
      tabActive: darkPrimary,
      avatarBg: darkPrimary,
      doneButton: darkPrimary,
    },
    light: {
      primary: lightPrimary,
      primaryMuted: lightPrimary + '15',
      primaryBorder: lightPrimary + '40',
      tabActive: lightPrimary,
      avatarBg: lightPrimary,
      doneButton: lightPrimary,
    },
  };
}

export const ACCENT_PRESETS: AccentPreset[] = [
  makePreset('purple', 'Purple', '#7C5CFC', '#6D4AE8'),
  makePreset('blue', 'Blue', '#3B82F6', '#2563EB'),
  makePreset('teal', 'Teal', '#14B8A6', '#0D9488'),
  makePreset('green', 'Green', '#22C55E', '#16A34A'),
  makePreset('pink', 'Pink', '#EC4899', '#DB2777'),
  makePreset('red', 'Red', '#EF4444', '#DC2626'),
  makePreset('orange', 'Orange', '#F97316', '#EA580C'),
  makePreset('gold', 'Gold', '#EAB308', '#CA8A04'),
  makePreset('cyan', 'Cyan', '#06B6D4', '#0891B2'),
  makePreset('rose', 'Rose', '#F43F5E', '#E11D48'),
];

const PRESET_MAP = new Map(ACCENT_PRESETS.map((p) => [p.key, p]));

export function getAccentPreset(key: string): AccentPreset {
  return PRESET_MAP.get(key) || ACCENT_PRESETS[0];
}
