import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Linking,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Bell,
  BellOff,
  MapPin,
  Clock,
  Navigation,
  Plus,
  X,
  ExternalLink,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { freeFoodService } from '../services/freefood.service';
import { CAMPUS_LOCATIONS, LOCATION_CATEGORIES } from '../data/campusLocations';
import BottomNav from '../components/BottomNav';

const FOOD_TYPES = [
  { id: 'pizza', label: 'Pizza', emoji: '\u{1F355}' },
  { id: 'sandwiches', label: 'Sandwiches', emoji: '\u{1F96A}' },
  { id: 'snacks', label: 'Snacks', emoji: '\u{1F36A}' },
  { id: 'drinks', label: 'Drinks', emoji: '\u{1F964}' },
  { id: 'baked_goods', label: 'Baked Goods', emoji: '\u{1F9C1}' },
  { id: 'fruit', label: 'Fruit', emoji: '\u{1F34E}' },
  { id: 'full_meal', label: 'Full Meal', emoji: '\u{1F37D}\uFE0F' },
  { id: 'other', label: 'Other', emoji: '\u{1F37D}\uFE0F' },
];

const EXPIRATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

function getRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getCountdown(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m left` : `${hrs}h left`;
}

export default function FreeFoodScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Post creation form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [foodType, setFoodType] = useState('pizza');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [customDetail, setCustomDetail] = useState('');
  const [expirationMins, setExpirationMins] = useState(120);

  // Countdown refresh ticker
  const [, setTick] = useState(0);

  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabScale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }).start();
  }, []);

  // Refresh countdowns every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const data = await freeFoodService.getActivePosts();
      setPosts(data);
    } catch (err) {
      console.log('Free food load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    try {
      const sub = await freeFoodService.isSubscribed();
      setSubscribed(sub);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadPosts();
    loadSubscription();

    // Get current user ID
    const { data: { subscription } } = require('../config/supabase').supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id || null);
      }
    );
    require('../config/supabase').supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });

    // Real-time subscription
    const channel = freeFoodService.subscribeToPostChanges(() => {
      loadPosts();
    });

    return () => {
      subscription.unsubscribe();
      channel?.unsubscribe();
    };
  }, [loadPosts, loadSubscription]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  const toggleSubscription = useCallback(async () => {
    try {
      if (subscribed) {
        await freeFoodService.unsubscribe();
        setSubscribed(false);
      } else {
        await freeFoodService.subscribe();
        setSubscribed(true);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }, [subscribed]);

  const handleDeactivate = useCallback(async (postId) => {
    Alert.alert('Mark as Gone', 'Mark this food as no longer available?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as Gone',
        style: 'destructive',
        onPress: async () => {
          try {
            await freeFoodService.deactivatePost(postId);
            loadPosts();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }, [loadPosts]);

  const handleGetDirections = useCallback((post) => {
    navigation.navigate('Map', {
      focusLocation: post.location_name,
      _ts: Date.now(),
    });
  }, [navigation]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setFoodType('pizza');
    setSelectedLocation(null);
    setCustomDetail('');
    setExpirationMins(120);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter what food is available.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Missing Info', 'Please select a location.');
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + expirationMins * 60000).toISOString();
      const foodTypeObj = FOOD_TYPES.find((f) => f.id === foodType);

      await freeFoodService.createPost({
        title: title.trim(),
        description: description.trim() || null,
        food_type: foodType,
        location_name: selectedLocation.name,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        custom_location_detail: customDetail.trim() || null,
        emoji: foodTypeObj?.emoji || '\u{1F355}',
        expires_at: expiresAt,
      });

      setShowModal(false);
      resetForm();
      loadPosts();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }, [title, description, foodType, selectedLocation, customDetail, expirationMins, resetForm, loadPosts]);

  const renderPostCard = useCallback(({ item: post }) => {
    const isOwner = currentUserId === post.posted_by;
    const posterName = post.poster?.display_name || post.poster?.username || 'Someone';

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postEmojiWrap}>
            <Text style={styles.postEmoji}>{post.emoji || '\u{1F355}'}</Text>
          </View>
          <View style={styles.postHeaderText}>
            <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
            <Text style={styles.postPoster} numberOfLines={1}>by {posterName}</Text>
          </View>
          <View style={styles.postTimeBadge}>
            <Text style={styles.postTimeText}>{getRelativeTime(post.created_at)}</Text>
          </View>
        </View>

        <View style={styles.postLocationRow}>
          <MapPin size={13} color={colors.accent} />
          <Text style={styles.postLocationText} numberOfLines={1}>
            {post.location_name}
            {post.custom_location_detail ? ` \u2022 ${post.custom_location_detail}` : ''}
          </Text>
        </View>

        <View style={styles.postMetaRow}>
          <View style={styles.foodTypeBadge}>
            <Text style={styles.foodTypeBadgeText}>
              {FOOD_TYPES.find((f) => f.id === post.food_type)?.label || post.food_type}
            </Text>
          </View>
          <View style={styles.countdownBadge}>
            <Clock size={11} color="#F59E0B" />
            <Text style={styles.countdownText}>{getCountdown(post.expires_at)}</Text>
          </View>
        </View>

        {post.description ? (
          <Text style={styles.postDescription} numberOfLines={2}>{post.description}</Text>
        ) : null}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => handleGetDirections(post)}
          >
            <Navigation size={14} color="#FFF" />
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              style={styles.goneBtn}
              onPress={() => handleDeactivate(post.id)}
            >
              <X size={14} color={colors.error} />
              <Text style={styles.goneBtnText}>Mark as Gone</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [styles, colors, currentUserId, handleGetDirections, handleDeactivate]);

  const selectedFoodType = FOOD_TYPES.find((f) => f.id === foodType);

  // Group locations by category for the picker
  const groupedLocations = useMemo(() => {
    const groups = {};
    LOCATION_CATEGORIES.filter((c) => c.id !== 'all').forEach((cat) => {
      groups[cat.id] = {
        label: cat.label,
        locations: CAMPUS_LOCATIONS.filter((loc) => loc.category === cat.id),
      };
    });
    return groups;
  }, []);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{'\u{1F355}'}</Text>
          <Text style={styles.headerTitle}>Free Food</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={toggleSubscription}>
          {subscribed ? (
            <Bell size={22} color="#22C55E" fill="#22C55E" />
          ) : (
            <BellOff size={22} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Subscription hint */}
      <View style={styles.subHint}>
        <AlertCircle size={13} color={colors.textTertiary} />
        <Text style={styles.subHintText}>
          {subscribed ? 'Notifications on \u2014 you\'ll be alerted of new posts' : 'Tap the bell to get notified of free food'}
        </Text>
      </View>

      {/* Posts list */}
      <FlatList
        data={loading ? [] : posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\u{1F37D}\uFE0F'}</Text>
              <Text style={styles.emptyTitle}>No free food right now</Text>
              <Text style={styles.emptySubtext}>Be the first to report some!</Text>
            </View>
          )
        }
      />

      {/* FAB */}
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Plus size={24} color="#FFF" />
          <Text style={styles.fabText}>Report Food</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Post creation modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Free Food</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={styles.fieldLabel}>What's the food?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Pizza from Dewick event"
                placeholderTextColor={colors.placeholder}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />

              {/* Food type chips */}
              <Text style={styles.fieldLabel}>Food type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {FOOD_TYPES.map((ft) => (
                  <TouchableOpacity
                    key={ft.id}
                    style={[styles.chip, foodType === ft.id && styles.chipActive]}
                    onPress={() => setFoodType(ft.id)}
                  >
                    <Text style={styles.chipEmoji}>{ft.emoji}</Text>
                    <Text style={[styles.chipText, foodType === ft.id && styles.chipTextActive]}>{ft.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Location picker */}
              <Text style={styles.fieldLabel}>Where?</Text>
              <ScrollView style={styles.locationPicker} nestedScrollEnabled>
                {Object.entries(groupedLocations).map(([catId, group]) => (
                  <View key={catId}>
                    <Text style={styles.locationGroupLabel}>{group.label}</Text>
                    {group.locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          styles.locationItem,
                          selectedLocation?.id === loc.id && styles.locationItemActive,
                        ]}
                        onPress={() => setSelectedLocation(loc)}
                      >
                        <Text style={styles.locationEmoji}>{loc.emoji}</Text>
                        <Text style={[
                          styles.locationName,
                          selectedLocation?.id === loc.id && styles.locationNameActive,
                        ]}>{loc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>

              {/* Custom location detail */}
              <Text style={styles.fieldLabel}>Which room/floor? (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Room 302, Lobby"
                placeholderTextColor={colors.placeholder}
                value={customDetail}
                onChangeText={setCustomDetail}
                maxLength={80}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Additional details (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="e.g. Leftover from CS department event, lots of veggie options"
                placeholderTextColor={colors.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={300}
              />

              {/* Expiration */}
              <Text style={styles.fieldLabel}>Estimated availability</Text>
              <View style={styles.chipRow}>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[styles.chip, expirationMins === opt.minutes && styles.chipActive]}
                    onPress={() => setExpirationMins(opt.minutes)}
                  >
                    <Clock size={12} color={expirationMins === opt.minutes ? '#FFF' : colors.textTertiary} />
                    <Text style={[styles.chipText, expirationMins === opt.minutes && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cross-post link */}
              <TouchableOpacity
                style={styles.crossPostLink}
                onPress={() => Linking.openURL('https://tufts.qualtrics.com/jfe/form/SV_bdwTIAnGV2MWEaW')}
              >
                <ExternalLink size={14} color={colors.accent} />
                <Text style={styles.crossPostText}>Also post to official Free Food list</Text>
              </TouchableOpacity>

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {selectedFoodType?.emoji || '\u{1F355}'} Post Free Food
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav navigation={navigation} activeTab="" />
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.headerBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // Sub hint
  subHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  subHintText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Post card
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postEmojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postEmoji: { fontSize: 22 },
  postHeaderText: { flex: 1 },
  postTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  postPoster: { fontSize: 12, fontWeight: '500', color: colors.textTertiary, marginTop: 1 },
  postTimeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
  },
  postTimeText: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },

  postLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postLocationText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 },

  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  foodTypeBadgeText: { fontSize: 11, fontWeight: '700', color: '#22C55E' },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  countdownText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },

  postDescription: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },

  postActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#418FDE',
  },
  directionsBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  goneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  goneBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textMuted },

  // FAB
  fabWrap: { position: 'absolute', bottom: 90, right: 16 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: '#FFF' },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    backgroundColor: colors.headerBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textTertiary },
  chipTextActive: { color: '#FFF' },

  // Location picker
  locationPicker: {
    maxHeight: 200,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  locationGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  locationItemActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  locationEmoji: { fontSize: 16 },
  locationName: { fontSize: 14, fontWeight: '600', color: colors.text },
  locationNameActive: { color: '#22C55E' },

  crossPostLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  crossPostText: { fontSize: 13, fontWeight: '600', color: colors.accent },

  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    marginTop: 8,
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
