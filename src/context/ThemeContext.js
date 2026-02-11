import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@jumbo_now_theme';

// Tufts Jumbos color palette — derived from the elephant logo
// Primary: #6AADE4 (light blue), #418FDE (Tufts Blue), #3579C6 (deep blue)
// Accent:  #A8B8C8 (silver/gray from logo)

const darkColors = {
  background: '#0B1928',
  backgroundGradient: ['#0B1928', '#102440', '#153058'],
  headerBg: '#102440',
  surface: 'rgba(106,173,228,0.08)',
  surfaceAlt: 'rgba(106,173,228,0.06)',
  card: 'rgba(106,173,228,0.12)',
  cardBorder: 'rgba(106,173,228,0.18)',
  glass: 'rgba(106,173,228,0.10)',
  glassBorder: 'rgba(106,173,228,0.16)',
  glassLight: 'rgba(106,173,228,0.12)',
  blurTint: 'dark',
  blurIntensity: 60,
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.75)',
  textTertiary: '#7BB8E8',
  textMuted: 'rgba(255,255,255,0.4)',
  accent: '#6AADE4',
  accentBg: 'rgba(106,173,228,0.14)',
  accentBorder: 'rgba(106,173,228,0.25)',
  accentMuted: 'rgba(106,173,228,0.4)',
  buttonPrimary: '#418FDE',
  buttonText: '#FFFFFF',
  inputBg: 'rgba(106,173,228,0.08)',
  inputBorder: 'rgba(106,173,228,0.14)',
  inputFocusBorder: 'rgba(106,173,228,0.45)',
  inputFocusBg: 'rgba(106,173,228,0.12)',
  placeholder: 'rgba(123,184,232,0.4)',
  error: '#EF4444',
  success: '#34D399',
  info: '#60A5FA',
  warning: '#FACC15',
  overlay: 'rgba(8,20,36,0.88)',
  modalBg: 'rgba(14,30,54,0.97)',
  divider: 'rgba(106,173,228,0.10)',
  statusBarStyle: 'light-content',
};

const lightColors = {
  background: '#E8F4FD',
  backgroundGradient: ['#E8F4FD', '#D6ECFA', '#C4E2F8'],
  headerBg: '#D6ECFA',
  surface: 'rgba(255,255,255,0.80)',
  surfaceAlt: 'rgba(255,255,255,0.60)',
  card: 'rgba(255,255,255,0.75)',
  cardBorder: 'rgba(106,173,228,0.20)',
  glass: 'rgba(255,255,255,0.70)',
  glassBorder: 'rgba(106,173,228,0.18)',
  glassLight: 'rgba(255,255,255,0.85)',
  blurTint: 'light',
  blurIntensity: 70,
  text: '#0B1A2E',
  textSecondary: '#2C5282',
  textTertiary: '#3B7CC0',
  textMuted: '#7BA3CC',
  accent: '#418FDE',
  accentBg: 'rgba(65,143,222,0.10)',
  accentBorder: 'rgba(65,143,222,0.22)',
  accentMuted: 'rgba(65,143,222,0.45)',
  buttonPrimary: '#418FDE',
  buttonText: '#FFFFFF',
  inputBg: 'rgba(255,255,255,0.65)',
  inputBorder: 'rgba(106,173,228,0.22)',
  inputFocusBorder: 'rgba(65,143,222,0.50)',
  inputFocusBg: 'rgba(255,255,255,0.85)',
  placeholder: '#93B5D6',
  error: '#DC2626',
  success: '#059669',
  info: '#2563EB',
  warning: '#D97706',
  overlay: 'rgba(11,26,46,0.50)',
  modalBg: 'rgba(232,244,253,0.95)',
  divider: 'rgba(65,143,222,0.10)',
  statusBarStyle: 'dark-content',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value !== null) {
        setIsDark(value === 'dark');
      }
      setLoaded(true);
    });
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    AsyncStorage.setItem(THEME_KEY, newIsDark ? 'dark' : 'light');
  };

  const colors = isDark ? darkColors : lightColors;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
