import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACTIVITY_EMOJIS = [
  '\u{1F3AD}', '\u{1F3C0}', '\u{1F4A1}', '\u{1F35C}', '\u{1F3AE}',
  '\u{2615}',  '\u{1F3B7}', '\u{1F308}', '\u{1F525}', '\u{1F3C6}',
  '\u{1F98B}', '\u{1F4A0}', '\u{1F389}', '\u{1F3B6}', '\u{26A1}',
  '\u{1F52E}', '\u{1F3AF}', '\u{1F3C9}', '\u{1F4AB}', '\u{1F3B2}',
  '\u{1F4BB}', '\u{1F382}', '\u{1F3BE}', '\u{1F30A}', '\u{1F3A8}',
  '\u{1F3B8}', '\u{1F9EA}', '\u{1F4F7}', '\u{2708}',  '\u{1F680}',
];

function FloatingEmoji({ emoji, delay, startX, duration }) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT + 40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = () => {
        translateY.setValue(SCREEN_HEIGHT + 40);
        opacity.setValue(0);
        scale.setValue(0.5 + Math.random() * 0.5);

        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -80,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.6 + Math.random() * 0.3,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.delay(duration - 3400),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 2200,
              useNativeDriver: true,
            }),
          ]),
          Animated.loop(
            Animated.sequence([
              Animated.timing(sway, {
                toValue: 15 + Math.random() * 20,
                duration: 1500 + Math.random() * 1000,
                useNativeDriver: true,
              }),
              Animated.timing(sway, {
                toValue: -(15 + Math.random() * 20),
                duration: 1500 + Math.random() * 1000,
                useNativeDriver: true,
              }),
            ]),
          ),
        ]).start(() => animate());
      };
      animate();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        transform: [
          { translateY },
          { translateX: sway },
          { scale },
        ],
        opacity,
      }}
    >
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
    </Animated.View>
  );
}

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);

  const s = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [emojis] = useState(() => {
    const items = [];
    for (let i = 0; i < 22; i++) {
      items.push({
        id: i,
        emoji: ACTIVITY_EMOJIS[i % ACTIVITY_EMOJIS.length],
        delay: i * 400 + Math.random() * 800,
        startX: Math.random() * (SCREEN_WIDTH - 50),
        duration: 6000 + Math.random() * 4000,
      });
    }
    return items;
  });

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 1000,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 800,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Fetch live stats
    (async () => {
      try {
        const now = new Date().toISOString();
        const { count: eventCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .gte('end_time', now);
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        if (eventCount != null) setLiveEventCount(eventCount);
        if (userCount != null) setStudentCount(userCount);
      } catch (err) {
        console.log('Stats fetch failed:', err?.message);
        // Show dashes instead of 0 on failure - counts stay at initial 0
      }
    })();
  }, []);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={s.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Emoji rain layer */}
      <View style={s.emojiLayer} pointerEvents="none">
        {emojis.map((item) => (
          <FloatingEmoji
            key={item.id}
            emoji={item.emoji}
            delay={item.delay}
            startX={item.startX}
            duration={item.duration}
          />
        ))}
      </View>

      {/* Gradient overlays for depth */}
      <View style={s.topFade} pointerEvents="none" />
      <View style={s.bottomFade} pointerEvents="none" />

      {/* Content */}
      <View style={[s.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}>
        {/* Logo area */}
        <Animated.View
          style={[
            s.logoArea,
            { transform: [{ scale: Animated.multiply(logoScale, logoPulse) }] },
          ]}
        >
          {/* Tufts Jumbos Logo */}
          <View style={s.logoCircle}>
            <Image
              source={require('../../assets/jumbo-logo.png')}
              style={s.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={s.logoTitle}>JumboNow</Text>
          <View style={s.tuftsRow}>
            <View style={s.tuftsLine} />
            <Text style={s.tuftsText}>TUFTS UNIVERSITY</Text>
            <View style={s.tuftsLine} />
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={[
            s.taglineArea,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <Text style={s.tagline}>
            What's happening{'\n'}on campus{' '}
            <Text style={s.taglineAccent}>right now</Text>
          </Text>
          <Text style={s.subtitle}>
            Browse campus events, reserve your spot,{'\n'}and never miss a moment at Tufts.
          </Text>

          {/* Live stats pill */}
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>{liveEventCount} events live now</Text>
            <Text style={s.liveSep}>{'\u2022'}</Text>
            <Text style={s.liveText}>{studentCount} students joined</Text>
          </View>
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View
          style={[
            s.ctaArea,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <TouchableOpacity
            style={s.primaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
            accessibilityLabel="Get started with JumboNow"
            accessibilityRole="button"
          >
            <Zap size={20} color={colors.background} />
            <Text style={s.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
            accessibilityLabel="Sign in to existing account"
            accessibilityRole="button"
          >
            <Text style={s.secondaryButtonText}>I already have an account</Text>
          </TouchableOpacity>

          <Text style={s.termsText}>
            By continuing, you agree to our{' '}
            <Text style={s.termsLink}>Terms</Text> &{' '}
            <Text style={s.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
  },
  emojiLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'transparent',
    // Simulated gradient with layered views
    borderBottomWidth: 0,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 350,
    backgroundColor: isDark ? 'rgba(11,26,46,0.85)' : 'rgba(239,244,249,0.85)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  logoTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -2,
    marginBottom: 8,
  },
  tuftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tuftsLine: {
    width: 30,
    height: 1,
    backgroundColor: colors.accentBorder,
  },
  tuftsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentMuted,
    letterSpacing: 4,
  },
  taglineArea: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 14,
  },
  taglineAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  liveSep: {
    fontSize: 8,
    color: colors.accentBorder,
  },
  ctaArea: {
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.background,
  },
  secondaryButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  termsText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  termsLink: {
    color: colors.accentMuted,
  },
});
