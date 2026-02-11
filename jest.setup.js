// Mock expo modules
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const icon = (props) => <Text>{props.testID || 'icon'}</Text>;
  return {
    Ticket: icon,
    Calendar: icon,
    MapPin: icon,
    Clock: icon,
    Search: icon,
    XCircle: icon,
    Star: icon,
  };
});

jest.mock('./src/config/supabase', () => ({
  supabase: {
    supabaseUrl: 'https://test-project.supabase.co',
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
  },
}));

jest.mock('./src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      text: '#FFFFFF',
      textMuted: '#888888',
      textTertiary: '#666666',
      accent: '#3E8EDE',
      accentBg: 'rgba(62,142,222,0.15)',
      accentBorder: 'rgba(62,142,222,0.3)',
      accentMuted: '#5A6B7F',
      glass: 'rgba(255,255,255,0.05)',
      glassBorder: 'rgba(255,255,255,0.1)',
      backgroundGradient: ['#0A0F1C', '#0F1629'],
      buttonPrimary: '#3E8EDE',
      success: '#22C55E',
      warning: '#F59E0B',
      error: '#EF4444',
      statusBarStyle: 'light-content',
    },
  }),
}));

jest.mock('./src/utils/safeColor', () => ({
  withOpacity: (color, opacity, fallback) => color || fallback || '#000',
}));

jest.mock('./src/components/BottomNav', () => {
  const { View } = require('react-native');
  return function BottomNav() {
    return <View testID="bottom-nav" />;
  };
});
