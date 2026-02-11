import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Check, User, Sparkles, Heart } from 'lucide-react-native';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INTERESTS = [
  { id: 'general', label: 'General Events', icon: '\u{1F300}' },
  { id: 'student_org', label: 'Student Orgs', icon: '\u{1F49C}' },
  { id: 'arts_culture', label: 'Arts & Culture', icon: '\u{1F3AD}' },
  { id: 'sports', label: 'Sports', icon: '\u{1F525}' },
  { id: 'academic', label: 'Academic', icon: '\u{1F4A1}' },
  { id: 'outdoors', label: 'Outdoors', icon: '\u{1F33F}' },
  { id: 'greek_life', label: 'Greek Life', icon: '\u{1F3DB}\uFE0F' },
  { id: 'campus_center', label: 'Campus Center', icon: '\u{1F48E}' },
];

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flatListRef = useRef(null);

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [major, setMajor] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);

  const totalSteps = 3;

  const toggleInterest = (id) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      flatListRef.current?.scrollToIndex({ index: step + 1, animated: true });
    }
  };

  const finish = async () => {
    try {
      const updates = {};
      if (displayName.trim()) updates.display_name = displayName.trim();
      if (major.trim()) updates.major = major.trim();

      // Save account type selected during registration
      const savedAccountType = await AsyncStorage.getItem('jumbonow_account_type');
      if (savedAccountType) {
        updates.account_type = savedAccountType;
      }

      if (Object.keys(updates).length > 0) {
        await authService.updateProfile(updates);
      }

      // Save interests and onboarding complete flag
      await AsyncStorage.setItem('jumbonow_onboarding_done', 'true');
      if (selectedInterests.length > 0) {
        await AsyncStorage.setItem('jumbonow_interests', JSON.stringify(selectedInterests));
      }

      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      // Even if save fails, proceed to home
      await AsyncStorage.setItem('jumbonow_onboarding_done', 'true');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };

  const skip = async () => {
    await AsyncStorage.setItem('jumbonow_onboarding_done', 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const renderStep = ({ index }) => {
    if (index === 0) {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.stepIconWrap}>
            <User size={40} color={colors.accent} />
          </View>
          <Text style={styles.stepTitle}>Welcome to JumboNow!</Text>
          <Text style={styles.stepSubtitle}>Let's set up your profile so other Jumbos can find you.</Text>
          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="What should we call you?"
            placeholderTextColor={colors.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
            autoFocus
          />
          <Text style={styles.inputLabel}>Major</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Computer Science"
            placeholderTextColor={colors.placeholder}
            value={major}
            onChangeText={setMajor}
            maxLength={100}
          />
        </View>
      );
    }

    if (index === 1) {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.stepIconWrap}>
            <Heart size={40} color="#EC4899" />
          </View>
          <Text style={styles.stepTitle}>What are you into?</Text>
          <Text style={styles.stepSubtitle}>Select your interests and we'll show you relevant events.</Text>
          <View style={styles.interestsGrid}>
            {INTERESTS.map((interest) => {
              const selected = selectedInterests.includes(interest.id);
              return (
                <TouchableOpacity
                  key={interest.id}
                  style={[styles.interestChip, selected && styles.interestChipSelected]}
                  onPress={() => toggleInterest(interest.id)}
                  accessibilityLabel={`${interest.label} ${selected ? 'selected' : ''}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.interestIcon}>{interest.icon}</Text>
                  <Text style={[styles.interestLabel, selected && styles.interestLabelSelected]}>
                    {interest.label}
                  </Text>
                  {selected && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepIconWrap}>
          <Sparkles size={40} color="#FACC15" />
        </View>
        <Text style={styles.stepTitle}>You're all set!</Text>
        <Text style={styles.stepSubtitle}>
          Start discovering events, making friends, and experiencing everything Tufts has to offer.
        </Text>
        <View style={styles.readyCard}>
          <Text style={styles.readyEmoji}>{'\u{1F418}'}</Text>
          <Text style={styles.readyText}>Ready to explore campus?</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={skip}
        accessibilityLabel="Skip onboarding"
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={[0, 1, 2]}
        renderItem={renderStep}
        keyExtractor={(item) => String(item)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Next / Finish button */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={step === totalSteps - 1 ? finish : nextStep}
          accessibilityLabel={step === totalSteps - 1 ? 'Get started' : 'Continue'}
          accessibilityRole="button"
        >
          {step === totalSteps - 1 ? (
            <>
              <Sparkles size={20} color="#FFF" />
              <Text style={styles.nextButtonText}>Let's Go!</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextButtonText}>Continue</Text>
              <ChevronRight size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  progressDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder },
  progressDotActive: { backgroundColor: colors.accent },
  skipButton: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: colors.accentMuted, fontSize: 14, fontWeight: '600' },
  stepContainer: { width: SCREEN_WIDTH, paddingHorizontal: 28, paddingTop: 40 },
  stepIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepTitle: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 10 },
  stepSubtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 28 },
  inputLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.inputBg, borderRadius: 14, padding: 16, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.accentBorder },
  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  interestChipSelected: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  interestIcon: { fontSize: 18 },
  interestLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: '700' },
  interestLabelSelected: { color: colors.accent },
  readyCard: { alignItems: 'center', padding: 32, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 20 },
  readyEmoji: { fontSize: 64, marginBottom: 16 },
  readyText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  bottomArea: { paddingHorizontal: 28, paddingBottom: 16 },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, backgroundColor: colors.buttonPrimary },
  nextButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
