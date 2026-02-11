import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';

export default function EmailVerificationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const email = route?.params?.email || '';

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Poll for email confirmation every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const confirmed = await authService.isEmailConfirmed();
        if (confirmed) {
          clearInterval(interval);
          navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [navigation]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const confirmed = await authService.isEmailConfirmed();
      if (confirmed) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      }
    } catch {}
    setChecking(false);
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await authService.resendConfirmation(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {}
    setResending(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <ArrowLeft size={22} color={colors.accent} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Mail size={40} color={colors.accent} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>
        <Text style={styles.hint}>
          Click the link in the email to verify your account. This page will update automatically.
        </Text>

        <TouchableOpacity
          style={styles.checkButton}
          onPress={handleCheckNow}
          disabled={checking}
          accessibilityLabel="Check verification status"
          accessibilityRole="button"
        >
          {checking ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <RefreshCw size={18} color="#FFF" />
              <Text style={styles.checkButtonText}>I've verified my email</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending || resent}
          accessibilityLabel="Resend verification email"
          accessibilityRole="button"
        >
          <Text style={[styles.resendText, resent && { color: colors.success }]}>
            {resent ? 'Email sent!' : resending ? 'Sending...' : 'Resend verification email'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { margin: 16, width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  iconCircle: { width: 88, height: 88, borderRadius: 28, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  emailText: { color: colors.accent, fontWeight: '700' },
  hint: { color: colors.textTertiary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  checkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: colors.buttonPrimary, marginBottom: 16 },
  checkButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  resendButton: { padding: 12 },
  resendText: { color: colors.accentMuted, fontSize: 14, fontWeight: '600' },
});
