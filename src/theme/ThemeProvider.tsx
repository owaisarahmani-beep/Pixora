import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

interface Theme {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  secondaryAccent: string;
}

const lightTheme: Theme = {
  background: colors.lightSurface,
  surface: '#FFFFFF',
  text: colors.textDark,
  textMuted: colors.textMuted,
  accent: colors.accent,
  secondaryAccent: colors.secondaryAccent,
};

const darkTheme: Theme = {
  background: colors.primaryBackground,
  surface: colors.darkSurface,
  text: colors.textLight,
  textMuted: colors.textMuted,
  accent: colors.accent,
  secondaryAccent: colors.secondaryAccent,
};

const ThemeContext = createContext<Theme>(darkTheme);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark' || colorScheme === null; // Default to dark for gallery
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
