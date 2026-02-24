import React, { useState, useEffect, lazy, Suspense } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './src/config/supabase';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { DemoProvider, useDemo } from './src/context/DemoContext';

// Eager: only the screens needed at cold start
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';

// Lazy: everything else loads on-demand when navigated to
const OnboardingScreen = lazy(() => import('./src/screens/OnboardingScreen'));
const EmailVerificationScreen = lazy(() => import('./src/screens/EmailVerificationScreen'));
const ProfileScreen = lazy(() => import('./src/screens/ProfileScreen'));
const NotificationsScreen = lazy(() => import('./src/screens/NotificationsScreen'));
const FriendsScreen = lazy(() => import('./src/screens/FriendsScreen'));
const DiscoverScreen = lazy(() => import('./src/screens/DiscoverScreen'));
const EventDetailScreen = lazy(() => import('./src/screens/EventDetailScreen'));
const MyTicketsScreen = lazy(() => import('./src/screens/MyTicketsScreen'));
const CreateEventScreen = lazy(() => import('./src/screens/CreateEventScreen'));
const ChatScreen = lazy(() => import('./src/screens/ChatScreen'));
const MapScreen = lazy(() => import('./src/screens/MapScreen'));
const FreeFoodScreen = lazy(() => import('./src/screens/FreeFoodScreen'));
const DiningScreen = lazy(() => import('./src/screens/DiningScreen'));
const DiningMenuScreen = lazy(() => import('./src/screens/DiningMenuScreen'));
const CampusResourcesScreen = lazy(() => import('./src/screens/CampusResourcesScreen'));
const GroupChatScreen = lazy(() => import('./src/screens/GroupChatScreen'));
const FreeFoodBanner = lazy(() => import('./src/components/FreeFoodBanner'));
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Suspense wrapper for lazy screens in React Navigation
function withSuspense(LazyComponent) {
  return function SuspenseScreen(props) {
    return (
      <Suspense fallback={<View style={suspenseStyles.container}><ActivityIndicator size="large" color="#418FDE" /></View>}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const suspenseStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// Deep linking configuration
const linking = {
  prefixes: ['jumbonow://', 'https://jumbonow.app'],
  config: {
    screens: {
      EventDetail: 'event/:eventId',
      Profile: 'profile',
      Home: 'home',
      Friends: 'friends',
      MyTickets: 'tickets',
      Map: 'map',
      FreeFood: 'freefood',
      GroupChat: 'groupchat/:groupConversationId',
      Dining: 'dining',
      DiningMenu: 'dining/:slug',
      CampusResources: 'campus',
    },
  },
};

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.log('App error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.emoji}>{'\u{1F635}'}</Text>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.subtitle}>The app ran into an unexpected error.</Text>
          <TouchableOpacity style={ebStyles.button} onPress={() => this.setState({ hasError: false })}>
            <Text style={ebStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F4FD', padding: 40 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#0B1A2E', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#3B7CC0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, backgroundColor: '#418FDE' },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});

function AppNavigator() {
  const { colors } = useTheme();
  const { isDemoMode, enterDemoMode } = useDemo();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  usePushNotifications(navigationRef, session);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // Restore demo mode if it was active
      const demoMode = await AsyncStorage.getItem('jumbonow_demo_mode');
      const demoRole = await AsyncStorage.getItem('jumbonow_demo_role');
      if (demoMode === 'true' && demoRole) {
        await enterDemoMode(demoRole);
      }

      const done = await AsyncStorage.getItem('jumbonow_onboarding_done');
      setOnboardingDone(done === 'true');

      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const initialRoute = isDemoMode ? 'Home' : !session ? 'Landing' : !onboardingDone ? 'Onboarding' : 'Home';

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Eager screens — available instantly */}
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />

        {/* Lazy screens — loaded on demand */}
        <Stack.Screen name="EmailVerification" component={withSuspense(EmailVerificationScreen)} />
        <Stack.Screen name="Onboarding" component={withSuspense(OnboardingScreen)} />
        <Stack.Screen name="Profile" component={withSuspense(ProfileScreen)} />
        <Stack.Screen name="Notifications" component={withSuspense(NotificationsScreen)} />
        <Stack.Screen name="Friends" component={withSuspense(FriendsScreen)} />
        <Stack.Screen name="Discover" component={withSuspense(DiscoverScreen)} />
        <Stack.Screen name="EventDetail" component={withSuspense(EventDetailScreen)} />
        <Stack.Screen name="MyTickets" component={withSuspense(MyTicketsScreen)} />
        <Stack.Screen name="CreateEvent" component={withSuspense(CreateEventScreen)} />
        <Stack.Screen name="Chat" component={withSuspense(ChatScreen)} />
        <Stack.Screen name="Map" component={withSuspense(MapScreen)} options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="FreeFood" component={withSuspense(FreeFoodScreen)} />
        <Stack.Screen name="Dining" component={withSuspense(DiningScreen)} />
        <Stack.Screen name="DiningMenu" component={withSuspense(DiningMenuScreen)} />
        <Stack.Screen name="CampusResources" component={withSuspense(CampusResourcesScreen)} />
        <Stack.Screen name="GroupChat" component={withSuspense(GroupChatScreen)} />
      </Stack.Navigator>
      {(session || isDemoMode) && (
        <Suspense fallback={null}>
          <FreeFoodBanner />
        </Suspense>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <DemoProvider>
            <AppNavigator />
          </DemoProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
