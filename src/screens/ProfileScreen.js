import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  StatusBar,
  Animated,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Settings,
  Edit3,
  MapPin,
  Calendar,
  Star,
  Clock,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  Moon,
  HelpCircle,
  MessageCircle,
  Ticket,
  BookOpen,
  Mail,
  FileText,
  Monitor,
  Trophy,
  ShieldAlert,
  GraduationCap,
  Utensils,
  Dumbbell,
  HeartPulse,
  WashingMachine,
  Car,
  Cpu,
  Bus,
  Pizza,
  ExternalLink,
} from 'lucide-react-native';
import { authService } from '../services/auth.service';
import { storageService } from '../services/storage.service';
import { ticketsService } from '../services/tickets.service';
import { achievementsService } from '../services/achievements.service';
import { eventsService } from '../services/events.service';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import SmartIcon from '../components/SmartIcon';
import { getEventIcon } from '../config/clubLogos';
import { useTheme } from '../context/ThemeContext';

const defaultProfile = {
  username: '',
  display_name: '',
  email: '',
  bio: '',
  graduation_year: '',
  avatar_url: null,
  avatar_color: '#6AADE4',
  is_verified: false,
  joined_date: '',
  events_attended: 0,
  tickets_count: 0,
  vibe_score: 50,
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeSection, setActiveSection] = useState('activity');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [editBio, setEditBio] = useState('');
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editGradYear, setEditGradYear] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState('#6AADE4');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pastEvents, setPastEvents] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [savedEventCount, setSavedEventCount] = useState(0);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingSavedEvents, setLoadingSavedEvents] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [settingsPage, setSettingsPage] = useState(null);
  const [notifSettings, setNotifSettings] = useState({
    events: true, reminders: true, social: true, marketing: false,
  });
  const [privacySettings, setPrivacySettings] = useState({
    profileVisible: true, showActivity: true, allowMessages: true,
  });
  const [editMajor, setEditMajor] = useState('');
  const [editCampus, setEditCampus] = useState('');

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  const fetchProfile = useCallback(async () => {
    try {
      const data = await authService.getCurrentProfile();
      if (data) {
        setProfile(data);
        setEditBio(data.bio || '');
        setEditName(data.display_name || '');
        setEditUsername(data.username || '');
        setEditGradYear(data.graduation_year || '');
        setEditAvatarColor(data.avatar_color || '#6AADE4');
        setEditMajor(data.major || '');
        setEditCampus(data.campus || '');
      }

      // Fetch saved events count
      try {
        const savedIds = await eventsService.getSavedEventIds();
        setSavedEventCount(savedIds.length);
      } catch (_) {
        setSavedEventCount(0);
      }

      // Fetch achievements from DB, fallback to hardcoded
      try {
        const achievementData = await achievementsService.getAchievementsWithStatus();
        if (achievementData && achievementData.length > 0) {
          setAchievements(achievementData);
        } else {
          setAchievements(achievementsService.getHardcodedAchievements());
        }
      } catch (achErr) {
        console.log('Using fallback achievements:', achErr.message);
        setAchievements(achievementsService.getHardcodedAchievements());
      }

      // Fetch friend count
      try {
        const count = await authService.getFriendCount();
        setFriendCount(count || 0);
      } catch (fcErr) {
        console.log('Failed to load friend count:', fcErr.message);
        setFriendCount(0);
      }

      // Fetch average rating for vibe score
      try {
        const avg = await ticketsService.getMyAverageRating();
        setAvgRating(avg || 0);
      } catch (_) {
        setAvgRating(0);
      }
    } catch (err) {
      console.log('Failed to load profile:', err.message);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const fetchMyTickets = useCallback(async () => {
    try {
      const tickets = await ticketsService.getMyTickets();
      setPastEvents(tickets.filter((t) => t.event).map((t) => ({
        id: t.id,
        eventId: t.event.id,
        icon: t.event.icon || '\uD83C\uDF89',
        title: t.event.title,
        date: new Date(t.event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        category: t.event.event_type?.replace('_', ' ') || 'general',
        attendees: t.event.attendee_count || 0,
        status: t.status,
      })));
    } catch (err) {
      console.log('Failed to load tickets:', err.message);
    }
  }, []);

  const fetchSavedEvents = useCallback(async () => {
    setLoadingSavedEvents(true);
    try {
      const savedIds = await eventsService.getSavedEventIds();
      if (savedIds.length === 0) {
        setSavedEvents([]);
        return;
      }
      const events = await eventsService.getEvents();
      const saved = events.filter((e) => savedIds.includes(e.id));
      setSavedEvents(saved);
    } catch (err) {
      console.log('Failed to load saved events:', err.message);
      setSavedEvents([]);
    } finally {
      setLoadingSavedEvents(false);
    }
  }, []);

  const handleEventsStatPress = useCallback(() => {
    setActiveSection('saved_events');
    if (savedEvents.length === 0) fetchSavedEvents();
  }, [savedEvents, fetchSavedEvents]);

  useEffect(() => {
    fetchProfile();
    fetchMyTickets();
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      Alert.alert('Error', 'Username cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authService.updateProfile({
        display_name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        bio: editBio.trim(),
        graduation_year: editGradYear.trim(),
        avatar_color: editAvatarColor,
        major: editMajor.trim(),
        campus: editCampus.trim(),
      });
      setProfile(updated);
      setShowEditModal(false);
      Alert.alert('Profile Updated', 'Your profile has been saved.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const publicUrl = await storageService.uploadProfileImage(uri);
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      Alert.alert('Success', 'Profile picture updated!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    Alert.alert('Remove Photo', 'Remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await storageService.deleteProfileImage();
            setProfile((prev) => ({ ...prev, avatar_url: null }));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to remove image.');
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
        },
      },
    ]);
  };

  // Compute live stats
  const ticketCount = pastEvents.length;
  const liveVibeScore = Math.min(100, 10 + (savedEventCount * 3) + (ticketCount * 5) + (friendCount * 2) + (avgRating * 4));

  const CAMPUS_RESOURCES = [
    { id: 'dining', label: 'Dining', Icon: Utensils, color: '#EF4444', navigate: 'Dining' },
    { id: 'canvas', label: 'Canvas', Icon: GraduationCap, color: '#E53E3E', url: 'https://canvas.tufts.edu' },
    { id: 'shuttle', label: 'Tufts Shuttle', Icon: Bus, color: '#3B82F6', navigate: 'Map' },
    { id: 'health', label: 'Health & Wellness', Icon: HeartPulse, color: '#6AADE4', url: 'https://students.tufts.edu/health-and-wellness' },
    { id: 'safety', label: 'Be Safe', Icon: ShieldAlert, color: '#F59E0B', url: 'https://publicsafety.tufts.edu' },
    { id: 'fitness', label: 'Fitness Center', Icon: Dumbbell, color: '#3579C6', url: 'https://ase.tufts.edu/campusrec' },
    { id: 'athletics', label: 'Athletics', Icon: Trophy, color: '#3579C6', url: 'https://gotuftsjumbos.com' },
    { id: 'apps', label: 'Apps & Software', Icon: Monitor, color: '#6366F1', url: 'https://it.tufts.edu/software' },
    { id: 'laundry', label: 'Laundry', Icon: WashingMachine, color: '#14B8A6', url: 'https://www.laundryview.com/tufts' },
    { id: 'parking', label: 'Parking', Icon: Car, color: '#64748B', url: 'https://publicsafety.tufts.edu/parking-services' },
    { id: 'technology', label: 'Technology', Icon: Cpu, color: '#0EA5E9', url: 'https://it.tufts.edu' },
    { id: 'freefood', label: 'Free Food', Icon: Pizza, color: '#22C55E', navigate: 'FreeFood' },
    { id: 'map', label: 'Campus Map', Icon: MapPin, color: '#418FDE', navigate: 'Map' },
    { id: 'studyspaces', label: 'Study Spaces', Icon: BookOpen, color: '#F97316', url: 'https://tischlibrary.tufts.edu' },
    { id: 'reserve', label: 'Reserve Tufts', Icon: Calendar, color: '#059669', url: 'https://reserve.tufts.edu/EmsWebApp/' },
  ];

  const sections = [
    { id: 'activity', label: 'Activity' },
    { id: 'campus', label: 'Campus' },
    { id: 'about', label: 'About' },
  ];

  return (
    <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setSettingsPage(null); setShowSettingsModal(true); }} accessibilityLabel="Open settings" accessibilityRole="button">
            <Settings size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardDismissMode="on-drag">
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {loadingProfile ? (
              <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
            ) : (
              <>
                <View style={styles.profileTop}>
                  <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} accessibilityLabel="Change profile picture" accessibilityRole="button">
                    <View style={[styles.avatar, { backgroundColor: profile.avatar_color || '#6AADE4' }]}>
                      {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(profile.display_name || profile.username || 'JN').slice(0, 2).toUpperCase()}
                        </Text>
                      )}
                      {uploadingImage && (
                        <View style={styles.avatarOverlay}>
                          <ActivityIndicator color="#FFF" size="small" />
                        </View>
                      )}
                      {profile.is_verified && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedCheck}>{'\u2713'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.editAvatarBadge}>
                      <Edit3 size={10} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.profileInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
                    </View>
                    <Text style={styles.username}>@{profile.username}</Text>
                    <View style={styles.metaRow}>
                      {profile.graduation_year ? (
                        <View style={styles.metaItem}>
                          <Calendar size={12} color={colors.accentMuted} />
                          <Text style={styles.metaText}>Class of {profile.graduation_year}</Text>
                        </View>
                      ) : null}
                      {profile.joined_date ? (
                        <View style={styles.metaItem}>
                          <Clock size={12} color={colors.accentMuted} />
                          <Text style={styles.metaText}>Joined {profile.joined_date}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                <Text style={styles.bio}>{profile.bio}</Text>

                <TouchableOpacity style={styles.editProfileBtn} onPress={() => setShowEditModal(true)} accessibilityLabel="Edit profile" accessibilityRole="button">
                  <Edit3 size={16} color={colors.accent} />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <TouchableOpacity style={[styles.statCard, activeSection === 'saved_events' && styles.statCardActive]} onPress={handleEventsStatPress} accessibilityLabel="View saved events" accessibilityRole="button">
              <Star size={20} color={colors.accent} />
              <Text style={styles.statNumber}>{savedEventCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('MyTickets')} accessibilityLabel="View my tickets" accessibilityRole="button">
              <Ticket size={20} color={colors.info} />
              <Text style={[styles.statNumber, { color: colors.info }]}>{ticketCount}</Text>
              <Text style={styles.statLabel}>Tickets</Text>
            </TouchableOpacity>
            <View style={styles.statCard}>
              <Star size={20} color={colors.warning} />
              <Text style={[styles.statNumber, { color: colors.warning }]}>{liveVibeScore}</Text>
              <Text style={styles.statLabel}>Vibe</Text>
            </View>
          </View>

          {/* Section Tabs */}
          <View style={styles.sectionTabs}>
            {sections.map((sec) => (
              <TouchableOpacity
                key={sec.id}
                style={[styles.sectionTab, activeSection === sec.id && styles.sectionTabActive]}
                onPress={() => setActiveSection(sec.id)}
                accessibilityLabel={`${sec.label} tab`}
                accessibilityRole="button"
              >
                <Text style={[styles.sectionTabText, activeSection === sec.id && styles.sectionTabTextActive]}>
                  {sec.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Activity Section */}
          {activeSection === 'activity' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Tickets</Text>
              {pastEvents.length === 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>No tickets yet. Reserve or buy tickets to events!</Text>
              )}
              {pastEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventItem}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event.eventId })}
                  accessibilityLabel={`View event: ${event.title}`}
                  accessibilityRole="button"
                >
                  <SmartIcon value={getEventIcon(event)} size={28} borderRadius={10} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventItemTitle}>{event.title}</Text>
                    <Text style={styles.eventItemMeta}>{event.date} {'\u2022'} {event.category} {'\u2022'} {event.status}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.accentMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Saved Events Section */}
          {activeSection === 'saved_events' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saved Events</Text>
              {loadingSavedEvents ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
              ) : savedEvents.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>No saved events yet. Bookmark events to see them here!</Text>
              ) : (
                savedEvents.map((event) => {
                  const start = new Date(event.start_time);
                  const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  const isFree = event.ticket_price === 0 || event.ticket_price === null;
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={styles.eventItem}
                      onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                      accessibilityLabel={`View event: ${event.title}`}
                      accessibilityRole="button"
                    >
                      <SmartIcon value={getEventIcon(event)} size={28} borderRadius={10} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventItemTitle}>{event.title}</Text>
                        <Text style={styles.eventItemMeta}>{dateStr} {'\u2022'} {timeStr} {'\u2022'} {isFree ? 'Free' : `$${event.ticket_price}`}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.accentMuted} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* Campus Resources Section */}
          {activeSection === 'campus' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Campus Resources</Text>
              <View style={styles.campusGrid}>
                {CAMPUS_RESOURCES.map((res) => {
                  const ResIcon = res.Icon;
                  return (
                    <TouchableOpacity
                      key={res.id}
                      style={styles.campusTile}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (res.navigate) {
                          navigation.navigate(res.navigate);
                        } else if (res.url) {
                          Linking.openURL(res.url);
                        }
                      }}
                    >
                      <View style={[styles.campusIconWrap, { backgroundColor: res.color + '18' }]}>
                        <ResIcon size={22} color={res.color} />
                      </View>
                      <Text style={styles.campusTileLabel} numberOfLines={2}>{res.label}</Text>
                      {res.url && (
                        <View style={styles.campusExternalBadge}>
                          <ExternalLink size={9} color={colors.textMuted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* About Section */}
          {activeSection === 'about' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.aboutCard}>
                <View style={styles.aboutRow}>
                  <Mail size={18} color={colors.accentMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aboutLabel}>Email</Text>
                    <Text style={styles.aboutValue}>{profile.email || 'Not set'}</Text>
                  </View>
                </View>
                <View style={styles.aboutDivider} />
                <View style={styles.aboutRow}>
                  <BookOpen size={18} color={colors.accentMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aboutLabel}>Major</Text>
                    <Text style={styles.aboutValue}>{profile.major || 'Not set'}</Text>
                  </View>
                </View>
                <View style={styles.aboutDivider} />
                <View style={styles.aboutRow}>
                  <Calendar size={18} color={colors.accentMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aboutLabel}>Graduation Year</Text>
                    <Text style={styles.aboutValue}>{profile.graduation_year || 'Not set'}</Text>
                  </View>
                </View>
                <View style={styles.aboutDivider} />
                <View style={styles.aboutRow}>
                  <MapPin size={18} color={colors.accentMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aboutLabel}>Campus</Text>
                    <Text style={styles.aboutValue}>{profile.campus || 'Tufts University - Medford'}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} accessibilityLabel="Close edit profile" accessibilityRole="button">
                <Text style={{ color: colors.accent, fontSize: 18 }}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Profile Picture Section */}
            <View style={styles.editAvatarSection}>
              <TouchableOpacity onPress={handlePickImage} style={[styles.editAvatarPreview, { backgroundColor: editAvatarColor }]} accessibilityLabel="Change profile picture" accessibilityRole="button">
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.editAvatarImage} />
                ) : (
                  <Text style={styles.editAvatarText}>
                    {(editName || editUsername || 'JN').slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </TouchableOpacity>
              <View style={styles.editAvatarButtons}>
                <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage} accessibilityLabel="Change photo" accessibilityRole="button">
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </TouchableOpacity>
                {profile.avatar_url && (
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={handleRemoveImage} accessibilityLabel="Remove photo" accessibilityRole="button">
                    <Text style={styles.removePhotoBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={colors.placeholder}
              placeholder="Your display name"
            />

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={editUsername}
              onChangeText={(text) => setEditUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholderTextColor={colors.placeholder}
              placeholder="username"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Graduation Year</Text>
            <TextInput
              style={styles.modalInput}
              value={editGradYear}
              onChangeText={setEditGradYear}
              placeholderTextColor={colors.placeholder}
              placeholder="e.g. 2027"
              keyboardType="number-pad"
              maxLength={4}
            />

            <Text style={styles.inputLabel}>Major</Text>
            <TextInput
              style={styles.modalInput}
              value={editMajor}
              onChangeText={setEditMajor}
              placeholderTextColor={colors.placeholder}
              placeholder="e.g. Computer Science"
            />

            <Text style={styles.inputLabel}>Campus</Text>
            <TextInput
              style={styles.modalInput}
              value={editCampus}
              onChangeText={setEditCampus}
              placeholderTextColor={colors.placeholder}
              placeholder="e.g. Tufts University - Medford"
            />

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholderTextColor={colors.placeholder}
              placeholder="Tell others about yourself..."
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{editBio.length}/500</Text>

            <Text style={styles.inputLabel}>Avatar Color</Text>
            <View style={styles.colorPicker}>
              {['#6AADE4', '#3B82F6', '#418FDE', '#3579C6', '#7EC4F0', '#A8B8C8', '#2B6CB0', '#F59E0B', '#22C55E', '#1E5A9E'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    editAvatarColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setEditAvatarColor(color)}
                  accessibilityLabel={`Select color ${color}`}
                  accessibilityRole="button"
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveButton, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              accessibilityLabel="Save profile changes"
              accessibilityRole="button"
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} animationType="slide" transparent onRequestClose={() => { if (settingsPage) setSettingsPage(null); else setShowSettingsModal(false); }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { if (settingsPage) setSettingsPage(null); else setShowSettingsModal(false); }} accessibilityLabel="Close settings" accessibilityRole="button">
          <TouchableOpacity style={styles.settingsContent} activeOpacity={1} onPress={() => {}}>

            {/* Main Settings Page */}
            {!settingsPage && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Settings</Text>
                  <TouchableOpacity onPress={() => setShowSettingsModal(false)} accessibilityLabel="Close settings" accessibilityRole="button">
                    <Text style={{ color: colors.accent, fontSize: 18 }}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.settingsGroup}>
                  <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsPage('notifications')} accessibilityLabel="Notifications settings" accessibilityRole="button">
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: colors.accentBg }]}>
                        <Bell size={18} color={colors.accent} />
                      </View>
                      <Text style={styles.settingsText}>Notifications</Text>
                    </View>
                    <ChevronRight size={18} color={colors.accentMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsPage('privacy')} accessibilityLabel="Privacy settings" accessibilityRole="button">
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: 'rgba(192,132,252,0.1)' }]}>
                        <Shield size={18} color="#7EC4F0" />
                      </View>
                      <Text style={styles.settingsText}>Privacy</Text>
                    </View>
                    <ChevronRight size={18} color={colors.accentMuted} />
                  </TouchableOpacity>

                  <View style={styles.settingsItem}>
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: 'rgba(244,114,182,0.1)' }]}>
                        <Moon size={18} color="#A8B8C8" />
                      </View>
                      <Text style={styles.settingsText}>Dark Mode</Text>
                    </View>
                    <Switch
                      value={isDark}
                      onValueChange={toggleTheme}
                      trackColor={{ false: colors.inputBorder, true: colors.accent }}
                      thumbColor="#FFF"
                    />
                  </View>

                  <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsPage('help')} accessibilityLabel="Help and support" accessibilityRole="button">
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: 'rgba(250,204,21,0.1)' }]}>
                        <HelpCircle size={18} color="#FACC15" />
                      </View>
                      <Text style={styles.settingsText}>Help & Support</Text>
                    </View>
                    <ChevronRight size={18} color={colors.accentMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsPage('terms')} accessibilityLabel="Terms of Service" accessibilityRole="button">
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: 'rgba(106,173,228,0.1)' }]}>
                        <FileText size={18} color={colors.accent} />
                      </View>
                      <Text style={styles.settingsText}>Terms of Service</Text>
                    </View>
                    <ChevronRight size={18} color={colors.accentMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsPage('privacy_policy')} accessibilityLabel="Privacy Policy" accessibilityRole="button">
                    <View style={styles.settingsItemLeft}>
                      <View style={[styles.settingsIcon, { backgroundColor: 'rgba(126,196,240,0.1)' }]}>
                        <Shield size={18} color="#7EC4F0" />
                      </View>
                      <Text style={styles.settingsText}>Privacy Policy</Text>
                    </View>
                    <ChevronRight size={18} color={colors.accentMuted} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityLabel="Log out" accessibilityRole="button">
                  <LogOut size={18} color={colors.error} />
                  <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Notifications Page */}
            {settingsPage === 'notifications' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSettingsPage(null)} accessibilityLabel="Back to settings" accessibilityRole="button">
                    <ArrowLeft size={22} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 12 }]}>Notifications</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  Control how JumboNow keeps you informed about campus events, ticket updates, and social activity. Customize your notification preferences below.
                </Text>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Event Updates</Text>
                    <Text style={styles.settingsSubtext}>Get notified when events you saved are updated, cancelled, or have limited spots remaining.</Text>
                  </View>
                  <Switch value={notifSettings.events} onValueChange={(v) => setNotifSettings((p) => ({ ...p, events: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Event Reminders</Text>
                    <Text style={styles.settingsSubtext}>Receive reminders 1 hour and 15 minutes before events you've RSVP'd to or purchased tickets for.</Text>
                  </View>
                  <Switch value={notifSettings.reminders} onValueChange={(v) => setNotifSettings((p) => ({ ...p, reminders: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Social Activity</Text>
                    <Text style={styles.settingsSubtext}>Get notified when friends save the same events as you or when someone interacts with your profile.</Text>
                  </View>
                  <Switch value={notifSettings.social} onValueChange={(v) => setNotifSettings((p) => ({ ...p, social: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Campus Highlights</Text>
                    <Text style={styles.settingsSubtext}>Weekly digest of trending events, new student organizations, and featured campus activities.</Text>
                  </View>
                  <Switch value={notifSettings.marketing} onValueChange={(v) => setNotifSettings((p) => ({ ...p, marketing: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>
              </ScrollView>
            )}

            {/* Privacy Page */}
            {settingsPage === 'privacy' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSettingsPage(null)} accessibilityLabel="Back to settings" accessibilityRole="button">
                    <ArrowLeft size={22} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 12 }]}>Privacy</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  Manage how your information is shared across JumboNow. Your privacy matters to us, and you have full control over your visibility on campus.
                </Text>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Public Profile</Text>
                    <Text style={styles.settingsSubtext}>Allow other Tufts students to see your profile, including your name, bio, and graduation year.</Text>
                  </View>
                  <Switch value={privacySettings.profileVisible} onValueChange={(v) => setPrivacySettings((p) => ({ ...p, profileVisible: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Show Activity</Text>
                    <Text style={styles.settingsSubtext}>Let others see which events you've saved and attended. Your ticket purchases are always private.</Text>
                  </View>
                  <Switch value={privacySettings.showActivity} onValueChange={(v) => setPrivacySettings((p) => ({ ...p, showActivity: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsText}>Allow Messages</Text>
                    <Text style={styles.settingsSubtext}>Allow other students to send you direct messages about events and campus activities.</Text>
                  </View>
                  <Switch value={privacySettings.allowMessages} onValueChange={(v) => setPrivacySettings((p) => ({ ...p, allowMessages: v }))} trackColor={{ false: colors.inputBorder, true: colors.accent }} thumbColor="#FFF" />
                </View>

                <View style={styles.settingsInfoBox}>
                  <Shield size={16} color={colors.accent} />
                  <Text style={styles.settingsInfoText}>
                    JumboNow uses end-to-end encryption for all messages and never shares your personal data with third parties. Your Tufts email is verified but never displayed publicly.
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Help & Support Page */}
            {settingsPage === 'help' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSettingsPage(null)} accessibilityLabel="Back to settings" accessibilityRole="button">
                    <ArrowLeft size={22} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 12 }]}>Help & Support</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  We're here to help you get the most out of JumboNow. Find answers to common questions or reach out to our support team.
                </Text>

                <Text style={styles.settingsSectionHeader}>Frequently Asked Questions</Text>

                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>How do I save an event?</Text>
                  <Text style={styles.faqAnswer}>Tap the bookmark icon on any event card to save it. Saved events appear in your profile and increase your Vibe score. You can unsave by tapping the bookmark again.</Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>What is the Vibe score?</Text>
                  <Text style={styles.faqAnswer}>Your Vibe score reflects how active you are on campus. It increases when you save events, purchase tickets, and connect with friends. The maximum score is 100.</Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>How do I get badges?</Text>
                  <Text style={styles.faqAnswer}>Badges are earned automatically as you use JumboNow. Save events, buy tickets, create events, and build your Vibe score to unlock all achievements.</Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>Can I get a refund for a ticket?</Text>
                  <Text style={styles.faqAnswer}>Refund policies vary by event organizer. Contact the event organizer directly through the event detail page, or reach out to our support team for assistance.</Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>How do I create an event?</Text>
                  <Text style={styles.faqAnswer}>Tap the "+" button on the home screen to create a new event. Fill in the details including title, date, location, and ticket pricing. All events require approval before going live.</Text>
                </View>

                <Text style={styles.settingsSectionHeader}>Contact Us</Text>
                <View style={styles.settingsInfoBox}>
                  <Mail size={16} color={colors.accent} />
                  <Text style={styles.settingsInfoText}>
                    Email: support@jumbonow.app{'\n'}
                    Response time: Within 24 hours{'\n'}
                    Available: Monday - Friday, 9 AM - 6 PM EST
                  </Text>
                </View>

                <View style={[styles.settingsInfoBox, { marginTop: 10 }]}>
                  <MessageCircle size={16} color={colors.accent} />
                  <Text style={styles.settingsInfoText}>
                    For urgent issues related to event safety or account security, please email urgent@jumbonow.app and we will respond within 2 hours.
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Terms of Service Page */}
            {settingsPage === 'terms' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSettingsPage(null)} accessibilityLabel="Back to settings" accessibilityRole="button">
                    <ArrowLeft size={22} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 12 }]}>Terms of Service</Text>
                </View>
                <Text style={styles.legalDate}>Last updated: February 2026</Text>

                <Text style={styles.legalHeading}>1. Acceptance of Terms</Text>
                <Text style={styles.legalText}>
                  By accessing or using the JumboNow mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). JumboNow is designed exclusively for students, faculty, and staff of Tufts University. By creating an account, you confirm that you are a current member of the Tufts University community with a valid @tufts.edu email address.
                </Text>

                <Text style={styles.legalHeading}>2. Account Registration</Text>
                <Text style={styles.legalText}>
                  You must register with a valid Tufts University email address. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate, current, and complete information during registration and to update such information as needed.
                </Text>

                <Text style={styles.legalHeading}>3. Event Listings & Tickets</Text>
                <Text style={styles.legalText}>
                  JumboNow serves as a platform for discovering and managing campus events. Event organizers are responsible for the accuracy of their event listings, including dates, times, locations, and pricing. Ticket purchases are final unless the event is cancelled by the organizer. JumboNow does not guarantee the availability of any event or ticket.
                </Text>

                <Text style={styles.legalHeading}>4. User Conduct</Text>
                <Text style={styles.legalText}>
                  You agree not to: (a) post false or misleading event information; (b) use the App to harass, bully, or intimidate other users; (c) create events that promote illegal activities; (d) attempt to circumvent security measures; (e) resell tickets at a markup unless explicitly authorized by the event organizer; (f) create multiple accounts or impersonate another user.
                </Text>

                <Text style={styles.legalHeading}>5. Content & Intellectual Property</Text>
                <Text style={styles.legalText}>
                  All content you upload to JumboNow, including event descriptions, images, and profile information, must be your own original work or properly licensed. By posting content, you grant JumboNow a non-exclusive, royalty-free license to display and distribute that content within the App. JumboNow retains all rights to its branding, design, and underlying technology.
                </Text>

                <Text style={styles.legalHeading}>6. Privacy & Data</Text>
                <Text style={styles.legalText}>
                  Your use of JumboNow is also governed by our Privacy Policy. We collect only the data necessary to provide our services and will never sell your personal information to third parties. Location data is used solely to enhance your campus experience and is never stored permanently.
                </Text>

                <Text style={styles.legalHeading}>7. Limitation of Liability</Text>
                <Text style={styles.legalText}>
                  JumboNow is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the App, including but not limited to event cancellations, lost tickets, or interactions with other users. Our total liability shall not exceed the amount you paid for tickets through the App in the preceding 12 months.
                </Text>

                <Text style={styles.legalHeading}>8. Termination</Text>
                <Text style={styles.legalText}>
                  We reserve the right to suspend or terminate your account at any time for violations of these Terms. Upon graduation or departure from Tufts University, your account will be transitioned to alumni status with limited features. You may delete your account at any time through the App settings.
                </Text>

                <Text style={styles.legalHeading}>9. Changes to Terms</Text>
                <Text style={styles.legalText}>
                  We may update these Terms from time to time. We will notify you of material changes through the App or via your registered email address. Continued use of JumboNow after changes constitutes acceptance of the updated Terms.
                </Text>

                <Text style={[styles.legalText, { marginTop: 16, fontStyle: 'italic' }]}>
                  If you have questions about these Terms, please contact us at legal@jumbonow.app.
                </Text>
              </ScrollView>
            )}

            {/* Privacy Policy Page */}
            {settingsPage === 'privacy_policy' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSettingsPage(null)} accessibilityLabel="Back to settings" accessibilityRole="button">
                    <ArrowLeft size={22} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 12 }]}>Privacy Policy</Text>
                </View>
                <Text style={styles.legalDate}>Last updated: February 2026</Text>

                <Text style={styles.legalHeading}>1. Information We Collect</Text>
                <Text style={styles.legalText}>
                  We collect information you provide directly: your Tufts email address, display name, username, graduation year, major, profile picture, and bio. We also collect usage data including events you save, tickets you purchase, and your interactions within the App. Device information such as OS version and device model may be collected for performance optimization.
                </Text>

                <Text style={styles.legalHeading}>2. How We Use Your Information</Text>
                <Text style={styles.legalText}>
                  Your information is used to: (a) provide and personalize the JumboNow experience; (b) process ticket purchases and reservations; (c) send event reminders and notifications you've opted into; (d) calculate your Vibe score and unlock achievements; (e) improve App performance and fix bugs; (f) ensure the safety and security of our campus community.
                </Text>

                <Text style={styles.legalHeading}>3. Information Sharing</Text>
                <Text style={styles.legalText}>
                  We do not sell, rent, or trade your personal information. We may share limited information with: (a) event organizers (your name and email when you RSVP or purchase tickets); (b) service providers who help us operate the App (hosting, analytics); (c) Tufts University administration when required for campus safety; (d) law enforcement when legally required.
                </Text>

                <Text style={styles.legalHeading}>4. Data Storage & Security</Text>
                <Text style={styles.legalText}>
                  Your data is stored securely using industry-standard encryption on Supabase cloud infrastructure. We implement row-level security policies to ensure users can only access their own data. Profile pictures are stored in encrypted cloud storage. We conduct regular security audits and follow OWASP security best practices.
                </Text>

                <Text style={styles.legalHeading}>5. Location Data</Text>
                <Text style={styles.legalText}>
                  JumboNow uses your location only when you actively use the Map or Shuttle features. Location data is processed in real-time to show nearby campus buildings and shuttle positions. We do not store your location history or track your movements. You can revoke location permissions at any time through your device settings.
                </Text>

                <Text style={styles.legalHeading}>6. Your Rights</Text>
                <Text style={styles.legalText}>
                  You have the right to: (a) access all personal data we store about you; (b) correct inaccurate information; (c) delete your account and all associated data; (d) export your data in a portable format; (e) opt out of non-essential notifications; (f) restrict the visibility of your profile and activity to other users.
                </Text>

                <Text style={styles.legalHeading}>7. Cookies & Analytics</Text>
                <Text style={styles.legalText}>
                  As a mobile application, JumboNow does not use traditional browser cookies. We use anonymous analytics to understand how features are used and to improve the App experience. Analytics data is aggregated and cannot be used to identify individual users.
                </Text>

                <Text style={styles.legalHeading}>8. Data Retention</Text>
                <Text style={styles.legalText}>
                  We retain your account data for as long as your account is active. Event and ticket data is retained for 2 years after the event date for record-keeping purposes. When you delete your account, all personal data is permanently removed within 30 days. Anonymized analytics data may be retained indefinitely.
                </Text>

                <Text style={styles.legalHeading}>9. Children's Privacy</Text>
                <Text style={styles.legalText}>
                  JumboNow is intended for Tufts University students aged 17 and older. We do not knowingly collect personal information from anyone under the age of 17. If we become aware that a user is under 17, we will take steps to remove their information and terminate their account.
                </Text>

                <Text style={styles.legalHeading}>10. Contact Us</Text>
                <Text style={styles.legalText}>
                  For privacy-related questions, data access requests, or concerns about your personal information, please contact our privacy team at privacy@jumbonow.app. We will respond to all privacy inquiries within 5 business days.
                </Text>

                <Text style={[styles.legalText, { marginTop: 16, fontStyle: 'italic', marginBottom: 20 }]}>
                  This privacy policy complies with applicable Massachusetts state privacy laws and university data protection guidelines.
                </Text>
              </ScrollView>
            )}

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  profileCard: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  profileTop: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 22,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  verifiedCheck: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  username: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.accentMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  editProfileText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 6,
  },
  statCardActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBorder,
  },
  statNumber: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionTabActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBorder,
  },
  sectionTabText: {
    color: colors.accentMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTabTextActive: {
    color: colors.accent,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  eventItemIcon: {
    fontSize: 28,
  },
  eventItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  eventItemMeta: {
    color: colors.accentMuted,
    fontSize: 12,
  },
  campusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  campusTile: {
    width: '31%',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
    position: 'relative',
  },
  campusIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusTileLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  campusExternalBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  aboutCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  aboutLabel: {
    color: colors.accentMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  aboutValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '85%',
  },
  editAvatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  editAvatarPreview: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  editAvatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  editAvatarButtons: {
    flex: 1,
    gap: 8,
  },
  changePhotoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
  },
  changePhotoBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  removePhotoBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  removePhotoBtnText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.text,
    borderWidth: 3,
  },
  settingsContent: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  inputLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  charCount: {
    color: colors.accentMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsGroup: {
    marginBottom: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 8,
  },
  logoutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  settingsDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  settingsSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginRight: 12,
  },
  settingsSectionHeader: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 10,
  },
  settingsInfoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    marginBottom: 8,
  },
  settingsInfoText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  faqItem: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  faqQuestion: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  faqAnswer: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  legalDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  legalHeading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  legalText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});
