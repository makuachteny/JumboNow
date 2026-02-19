import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@jumbo_now_theme';

// Tufts Jumbos color palette — derived from the elephant logo
// Primary: #6AADE4 (light blue), #418FDE (Tufts Blue), #3579C6 (deep blue)
// Accent:  #A8B8C8 (silver/gray from logo)

const darkColors = {
  // Deep navy base — dark but with blue warmth
  background: '#060D17',
  backgroundGradient: ['#060D17', '#0A1525', '#0E1C30'],
  headerBg: '#081220',

  // Surfaces — blue-tinted, blends with the navy base
  surface: 'rgba(106,173,228,0.06)',
  surfaceAlt: 'rgba(106,173,228,0.04)',

  // Cards — slightly lifted with cool blue tone
  card: 'rgba(106,173,228,0.07)',
  cardBorder: 'rgba(106,173,228,0.10)',

  // Glass — frosted blue feel
  glass: 'rgba(106,173,228,0.06)',
  glassBorder: 'rgba(106,173,228,0.09)',
  glassLight: 'rgba(106,173,228,0.07)',

  blurTint: 'dark',
  blurIntensity: 80,

  // Text hierarchy — crisp white on navy, soft blues for secondary
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.68)',
  textTertiary: '#5A9FD4',
  textMuted: 'rgba(255,255,255,0.32)',

  // Accent — vibrant blue for interactive elements
  accent: '#6AADE4',
  accentBg: 'rgba(106,173,228,0.10)',
  accentBorder: 'rgba(106,173,228,0.18)',
  accentMuted: 'rgba(106,173,228,0.30)',
  buttonPrimary: '#418FDE',
  buttonText: '#FFFFFF',

  // Inputs — matches the blue-tinted surface
  inputBg: 'rgba(106,173,228,0.05)',
  inputBorder: 'rgba(106,173,228,0.09)',
  inputFocusBorder: 'rgba(106,173,228,0.40)',
  inputFocusBg: 'rgba(106,173,228,0.08)',
  placeholder: 'rgba(90,159,212,0.40)',

  // Status
  error: '#EF4444',
  success: '#10B981',
  info: '#60A5FA',
  warning: '#D4A017',

  // Overlays
  overlay: 'rgba(4,8,16,0.92)',
  modalBg: 'rgba(6,13,23,0.97)',
  divider: 'rgba(106,173,228,0.06)',
  statusBarStyle: 'light-content',

  // Secondary accent (Tufts palette)
  purple: '#3579C6',
  purpleLight: '#6AADE4',
  purpleBg: 'rgba(53,121,198,0.12)',
  purpleBorder: 'rgba(53,121,198,0.25)',
  purpleGradient: ['#418FDE', '#3579C6', '#2B6CB0'],
  gradientBar: ['#6AADE4', '#418FDE', '#3579C6', '#2B6CB0', '#1E5A9E', '#163D6B'],
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

  // Secondary accent (Tufts palette)
  purple: '#2B6CB0',
  purpleLight: '#418FDE',
  purpleBg: 'rgba(43,108,176,0.08)',
  purpleBorder: 'rgba(43,108,176,0.20)',
  purpleGradient: ['#418FDE', '#3579C6', '#2B6CB0'],
  gradientBar: ['#6AADE4', '#418FDE', '#3579C6', '#2B6CB0', '#1E5A9E', '#163D6B'],
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
