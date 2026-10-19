import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  isDark: boolean;
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  secondaryAccent: string;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const lightTheme: Omit<Theme, 'themePreference' | 'setThemePreference'> = {
  isDark: false,
  background: colors.lightBackground,
  surface: colors.lightSurface,
  card: colors.lightCard,
  border: colors.lightBorder,
  text: colors.lightText,
  textMuted: colors.lightTextMuted,
  accent: colors.lightAccent,
  secondaryAccent: colors.secondaryAccent,
};

const darkTheme: Omit<Theme, 'themePreference' | 'setThemePreference'> = {
  isDark: true,
  background: colors.darkBackground,
  surface: colors.darkSurface,
  card: colors.darkCard,
  border: colors.darkBorder,
  text: colors.darkText,
  textMuted: colors.darkTextMuted,
  accent: colors.darkAccent,
  secondaryAccent: colors.secondaryAccent,
};

const THEME_STORAGE_KEY = '@pixora_theme_preference';

const ThemeContext = createContext<Theme>({
  ...darkTheme,
  themePreference: 'system',
  setThemePreference: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemePreferenceState(stored);
      }
    }).catch(() => {});
  }, []);

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return systemColorScheme === 'dark' || systemColorScheme === null;
  }, [themePreference, systemColorScheme]);

  const activeTheme = isDark ? darkTheme : lightTheme;

  const value: Theme = useMemo(() => ({
    ...activeTheme,
    themePreference,
    setThemePreference,
  }), [activeTheme, themePreference]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
