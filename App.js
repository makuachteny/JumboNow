import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './src/config/supabase';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import EmailVerificationScreen from './src/screens/EmailVerificationScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import MyTicketsScreen from './src/screens/MyTicketsScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import ChatScreen from './src/screens/ChatScreen';
import MapScreen from './src/screens/MapScreen';
import FreeFoodScreen from './src/screens/FreeFoodScreen';
import DiningScreen from './src/screens/DiningScreen';
import DiningMenuScreen from './src/screens/DiningMenuScreen';
import FreeFoodBanner from './src/components/FreeFoodBanner';
import { usePushNotifications } from './src/hooks/usePushNotifications';

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
      Dining: 'dining',
      DiningMenu: 'dining/:slug',
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
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  usePushNotifications(navigationRef, session);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

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

  const initialRoute = !session ? 'Landing' : !onboardingDone ? 'Onboarding' : 'Home';

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
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="Discover" component={DiscoverScreen} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Map" component={MapScreen} options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="FreeFood" component={FreeFoodScreen} />
        <Stack.Screen name="Dining" component={DiningScreen} />
        <Stack.Screen name="DiningMenu" component={DiningMenuScreen} />
      </Stack.Navigator>
      {session && <FreeFoodBanner />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <AppNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
