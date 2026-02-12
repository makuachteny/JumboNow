import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Zap, GraduationCap } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/auth.service';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const s = useMemo(() => createStyles(colors), [colors]);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSSO = async () => {
    setSsoLoading(true);
    try {
      const data = await authService.signInWithSSO();
      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (error) {
      if (error.message === 'SSO_NOT_CONFIGURED') {
        Alert.alert(
          'Coming Soon',
          'Tufts SSO login is coming soon. Please use email and password for now.',
        );
      } else {
        Alert.alert('SSO Error', 'Unable to start SSO login. Please try again.');
      }
    } finally {
      setSsoLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn({ email: email.trim(), password });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      Alert.alert(
        'Login Failed',
        'Invalid email or password. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={colors.backgroundGradient} style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            s.scrollContent,
            { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity
              style={s.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={22} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              s.formArea,
              { opacity: fadeIn, transform: [{ translateY: slideUp }] },
            ]}
          >
            {/* Logo */}
            <View style={s.logoArea}>
              <Image
                source={require('../../assets/jumbo-logo.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <View style={s.titleArea}>
              <Text style={s.welcomeBack}>Welcome back</Text>
              <Text style={s.titleSubtext}>
                Sign in to see what's happening at Tufts
              </Text>
            </View>

            {/* Email Input */}
            <View
              style={[
                s.inputContainer,
                focusedField === 'email' && s.inputFocused,
              ]}
            >
              <Mail
                size={18}
                color={focusedField === 'email' ? colors.accent : colors.accentMuted}
              />
              <TextInput
                style={s.input}
                placeholder="Username or email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                keyboardType="email-address"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password Input */}
            <View
              style={[
                s.inputContainer,
                focusedField === 'password' && s.inputFocused,
              ]}
            >
              <Lock
                size={18}
                color={focusedField === 'password' ? colors.accent : colors.accentMuted}
              />
              <TextInput
                style={s.input}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.accentMuted} />
                ) : (
                  <Eye size={18} color={colors.accentMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[s.loginButton, loading && s.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Zap size={18} color={colors.background} />
                  <Text style={s.loginButtonText}>Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* SSO Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* SSO Button */}
            <TouchableOpacity
              style={[s.ssoButton, ssoLoading && s.loginButtonDisabled]}
              onPress={handleSSO}
              activeOpacity={0.85}
              disabled={ssoLoading}
            >
              {ssoLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <GraduationCap size={18} color={colors.accent} />
                  <Text style={s.ssoButtonText}>Sign in with Tufts SSO</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={s.signupRow}>
              <Text style={s.signupText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={s.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formArea: {
    flex: 1,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  titleArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeBack: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleSubtext: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 4,
    marginBottom: 12,
  },
  inputFocused: {
    borderColor: colors.inputFocusBorder,
    backgroundColor: colors.inputFocusBg,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.background,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inputBorder,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 24,
  },
  ssoButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
});
