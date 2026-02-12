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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, GraduationCap, Zap } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/auth.service';

const ACCOUNT_TYPES = [
  { id: 'student', label: 'Student', icon: '\uD83C\uDF93' },
  { id: 'staff', label: 'Staff', icon: '\uD83C\uDFE2' },
  { id: 'club', label: 'Club', icon: '\uD83C\uDFDB\uFE0F' },
];

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [accountType, setAccountType] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

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

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@tufts\.edu$/i;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid Tufts University email (@tufts.edu).');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.signUp({
        email,
        password,
        username,
        graduationYear,
        accountType,
      });
      await AsyncStorage.setItem('jumbonow_account_type', accountType);
      Alert.alert(
        'Welcome to JumboNow!',
        'Your account has been created. Please sign in.',
        [{ text: 'Sign In', onPress: () => navigation.navigate('Login') }],
      );
    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'Registration failed. Please try again.');
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
              <Text style={s.title}>Join JumboNow</Text>
              <Text style={s.titleSubtext}>
                Connect with the Tufts community
              </Text>
            </View>

            {/* Username Input */}
            <View
              style={[
                s.inputContainer,
                focusedField === 'username' && s.inputFocused,
              ]}
            >
              <User
                size={18}
                color={focusedField === 'username' ? colors.accent : colors.accentMuted}
              />
              <TextInput
                style={s.input}
                placeholder="Username"
                placeholderTextColor={colors.placeholder}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
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
                placeholder="Tufts email (@tufts.edu)"
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

            {/* Graduation Year Input */}
            <View
              style={[
                s.inputContainer,
                focusedField === 'gradYear' && s.inputFocused,
              ]}
            >
              <GraduationCap
                size={18}
                color={focusedField === 'gradYear' ? colors.accent : colors.accentMuted}
              />
              <TextInput
                style={s.input}
                placeholder="Graduation year (e.g. 2027)"
                placeholderTextColor={colors.placeholder}
                value={graduationYear}
                onChangeText={setGraduationYear}
                keyboardType="number-pad"
                maxLength={4}
                onFocus={() => setFocusedField('gradYear')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Account Type Selector */}
            <Text style={s.accountTypeLabel}>I am a...</Text>
            <View style={s.accountTypeRow}>
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[s.accountTypeOption, accountType === type.id && s.accountTypeOptionActive]}
                  onPress={() => setAccountType(type.id)}
                  accessibilityLabel={`Account type: ${type.label}${accountType === type.id ? ', selected' : ''}`}
                  accessibilityRole="radio"
                >
                  <Text style={s.accountTypeIcon}>{type.icon}</Text>
                  <Text style={[s.accountTypeText, accountType === type.id && s.accountTypeTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
                placeholder="Password (min 8 characters)"
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

            {/* Confirm Password Input */}
            <View
              style={[
                s.inputContainer,
                focusedField === 'confirmPassword' && s.inputFocused,
              ]}
            >
              <Lock
                size={18}
                color={focusedField === 'confirmPassword' ? colors.accent : colors.accentMuted}
              />
              <TextInput
                style={s.input}
                placeholder="Confirm password"
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} color={colors.accentMuted} />
                ) : (
                  <Eye size={18} color={colors.accentMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[s.registerButton, loading && s.registerButtonDisabled]}
              onPress={handleRegister}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Zap size={18} color={colors.background} />
                  <Text style={s.registerButtonText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={s.loginRow}>
              <Text style={s.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={s.loginLink}>Sign in</Text>
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
    marginBottom: 10,
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
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  titleArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
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
  accountTypeLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  accountTypeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    gap: 4,
  },
  accountTypeOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.inputFocusBg,
  },
  accountTypeIcon: {
    fontSize: 22,
  },
  accountTypeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  accountTypeTextActive: {
    color: colors.accent,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    marginTop: 12,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.background,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
});
