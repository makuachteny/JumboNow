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
  Image,
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
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
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

const ETA_OPTIONS = ['5 min', '10 min', '15 min', '30 min'];

export default function FreeFoodScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flatListRef = useRef(null);

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
  const [imageUri, setImageUri] = useState(null);

  // Accept/confirm flow state
  const [myRequests, setMyRequests] = useState({}); // { postId: request }
  const [expandedPostId, setExpandedPostId] = useState(null); // which card is expanded
  const [expandedRequests, setExpandedRequests] = useState(null); // postId for requester list
  const [postRequests, setPostRequests] = useState({}); // { postId: [requests] }

  // Accept form modal state
  const [acceptModalPostId, setAcceptModalPostId] = useState(null);
  const [acceptPartySize, setAcceptPartySize] = useState(1);
  const [acceptEta, setAcceptEta] = useState(null);
  const [acceptDietaryNotes, setAcceptDietaryNotes] = useState('');
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);

  // Confirmation modal state
  const [confirmationCode, setConfirmationCode] = useState(null);

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

  const loadMyRequests = useCallback(async () => {
    try {
      const reqs = await freeFoodService.getMyRequests();
      const map = {};
      reqs.forEach((r) => { map[r.post_id] = r; });
      setMyRequests(map);
    } catch {}
  }, []);

  useEffect(() => {
    loadPosts();
    loadSubscription();
    loadMyRequests();

    // Get current user ID
    const { data: { subscription } } = require('../config/supabase').supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id || null);
      }
    );
    require('../config/supabase').supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });

    // Real-time subscription for post changes
    const channel = freeFoodService.subscribeToPostChanges(() => {
      loadPosts();
    });

    // Real-time subscription for request status changes (e.g. poster confirms)
    const reqChannel = require('../config/supabase').supabase
      .channel('free-food-my-requests')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'free_food_requests',
      }, (payload) => {
        if (payload.new) {
          setMyRequests((prev) => {
            if (prev[payload.new.post_id]) {
              const updated = { ...prev, [payload.new.post_id]: payload.new };
              if (payload.new.status === 'confirmed' && payload.old?.status === 'pending') {
                setConfirmationCode(payload.new.confirmation_code);
              }
              if (payload.new.status === 'declined' && payload.old?.status === 'pending') {
                Alert.alert('Spots Filled', 'Sorry, all spots for this food have been claimed. Better luck next time!');
              }
              return updated;
            }
            return prev;
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      channel?.unsubscribe();
      reqChannel?.unsubscribe();
    };
  }, [loadPosts, loadSubscription]);

  // Scroll to focused post when navigated from notification
  useEffect(() => {
    if (route?.params?.focusPostId && posts.length > 0) {
      const idx = posts.findIndex(p => p.id === route.params.focusPostId);
      if (idx >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewOffset: 20 });
        }, 300);
      }
    }
  }, [route?.params?.focusPostId, posts]);

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
    setImageUri(null);
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const openAcceptModal = useCallback((postId) => {
    setAcceptModalPostId(postId);
    setAcceptPartySize(1);
    setAcceptEta(null);
    setAcceptDietaryNotes('');
  }, []);

  const closeAcceptModal = useCallback(() => {
    setAcceptModalPostId(null);
  }, []);

  const handleAcceptSubmit = useCallback(async () => {
    if (!acceptModalPostId) return;
    setAcceptSubmitting(true);
    try {
      const req = await freeFoodService.requestFood(acceptModalPostId, {
        partySize: acceptPartySize,
        eta: acceptEta,
        dietaryNotes: acceptDietaryNotes.trim() || null,
      });
      setMyRequests((prev) => ({ ...prev, [acceptModalPostId]: req }));
      setAcceptModalPostId(null);
      // Don't show confirmation code yet — wait for the poster to confirm
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request.');
    } finally {
      setAcceptSubmitting(false);
    }
  }, [acceptModalPostId, acceptPartySize, acceptEta, acceptDietaryNotes]);

  const handleLoadRequests = useCallback(async (postId) => {
    if (expandedRequests === postId) {
      setExpandedRequests(null);
      return;
    }
    setExpandedRequests(postId);
    try {
      const reqs = await freeFoodService.getRequests(postId);
      setPostRequests((prev) => ({ ...prev, [postId]: reqs }));
    } catch {}
  }, [expandedRequests]);

  const handleConfirmRequest = useCallback(async (requestId, postId) => {
    try {
      await freeFoodService.confirmRequest(requestId);
      const reqs = await freeFoodService.getRequests(postId);
      setPostRequests((prev) => ({ ...prev, [postId]: reqs }));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to confirm.');
    }
  }, []);

  const handleDeclineRequest = useCallback(async (requestId, postId) => {
    try {
      await freeFoodService.declineRequest(requestId);
      const reqs = await freeFoodService.getRequests(postId);
      setPostRequests((prev) => ({ ...prev, [postId]: reqs }));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to decline.');
    }
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
    if (!imageUri) {
      Alert.alert('Photo Required', 'Please add a photo of the food so people know what to expect.');
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + expirationMins * 60000).toISOString();
      const foodTypeObj = FOOD_TYPES.find((f) => f.id === foodType);

      let uploadedImageUrl = null;
      if (imageUri) {
        uploadedImageUrl = await freeFoodService.uploadFoodImage(imageUri);
      }

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
        image_url: uploadedImageUrl,
      });

      setShowModal(false);
      resetForm();
      loadPosts();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }, [title, description, foodType, selectedLocation, customDetail, expirationMins, imageUri, resetForm, loadPosts]);

  const renderPostCard = useCallback(({ item: post }) => {
    const isOwner = currentUserId === post.posted_by;
    const posterName = post.poster?.display_name || post.poster?.username || 'Someone';
    const myRequest = myRequests[post.id];
    const isExpanded = expandedRequests === post.id;
    const reqs = postRequests[post.id] || [];

    const countdown = getCountdown(post.expires_at);
    const foodLabel = FOOD_TYPES.find((f) => f.id === post.food_type)?.label || post.food_type;
    const isCardExpanded = expandedPostId === post.id;

    return (
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.9}
        onPress={() => setExpandedPostId(isCardExpanded ? null : post.id)}
      >
        {/* Compact card — food image as background */}
        <View style={styles.cardPreview}>
          {post.image_url && (
            <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.cardPreviewTop}>
            <View style={styles.countdownChip}>
              <Clock size={10} color="#FFF" />
              <Text style={styles.countdownChipText}>{countdown}</Text>
            </View>
            {isOwner && (
              <View style={styles.ownerTag}>
                <Text style={styles.ownerTagText}>Your post</Text>
              </View>
            )}
          </View>
          <View style={styles.cardPreviewBottom}>
            <Text style={styles.cardTitle} numberOfLines={1}>{post.emoji || '\u{1F355}'} {post.title}</Text>
            <View style={styles.cardSubRow}>
              <MapPin size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.cardLocation} numberOfLines={1}>{post.location_name}</Text>
              <Text style={styles.cardDot}>{'\u00B7'}</Text>
              <Text style={styles.cardPoster} numberOfLines={1}>{posterName}</Text>
            </View>
          </View>
        </View>

        {/* Expanded details */}
        {isCardExpanded && (
          <View style={styles.expandedBody}>
            {post.custom_location_detail && (
              <View style={styles.detailRow}>
                <MapPin size={12} color="#22C55E" />
                <Text style={styles.detailText}>{post.custom_location_detail}</Text>
              </View>
            )}

            <View style={styles.expandedBadgeRow}>
              <View style={styles.foodTypeBadge}>
                <Text style={styles.foodTypeBadgeText}>{foodLabel}</Text>
              </View>
              <Text style={styles.detailTime}>{getRelativeTime(post.created_at)}</Text>
            </View>

            {post.description ? (
              <Text style={styles.postDescription}>{post.description}</Text>
            ) : null}

            <View style={styles.postActions}>
              {!isOwner && (
                <TouchableOpacity
                  style={styles.directionsBtn}
                  onPress={() => handleGetDirections(post)}
                >
                  <Navigation size={13} color="#FFF" />
                  <Text style={styles.directionsBtnText}>Directions</Text>
                </TouchableOpacity>
              )}

              {!isOwner && (
                myRequest ? (
                  myRequest.status === 'confirmed' ? (
                    <TouchableOpacity
                      style={styles.confirmCodeBadge}
                      onPress={() => setConfirmationCode(myRequest.confirmation_code)}
                    >
                      <Check size={13} color="#FFF" />
                      <Text style={styles.confirmCodeBadgeText}>
                        {myRequest.confirmation_code || 'Confirmed'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={myRequest.status === 'declined' ? styles.declinedBadge : styles.pendingBadge}>
                      {myRequest.status === 'declined' ? (
                        <X size={13} color={colors.error} />
                      ) : (
                        <Clock size={13} color="#F59E0B" />
                      )}
                      <Text style={myRequest.status === 'declined' ? styles.declinedBadgeText : styles.pendingBadgeText}>
                        {myRequest.status === 'declined' ? 'Spots filled' : 'Pending...'}
                      </Text>
                    </View>
                  )
                ) : (
                  <TouchableOpacity
                    style={styles.comingBtn}
                    onPress={() => openAcceptModal(post.id)}
                  >
                    <Text style={styles.comingBtnText}>I'm Coming!</Text>
                  </TouchableOpacity>
                )
              )}

              {isOwner && (
                <TouchableOpacity
                  style={styles.goneBtn}
                  onPress={() => handleDeactivate(post.id)}
                >
                  <X size={13} color={colors.error} />
                  <Text style={styles.goneBtnText}>Mark as Gone</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Owner: request count + expandable list (inside expanded) */}
        {isOwner && isCardExpanded && (
          <TouchableOpacity style={styles.requestCountRow} onPress={() => handleLoadRequests(post.id)}>
            <Text style={styles.requestCountText}>
              {reqs.length > 0
                ? (() => {
                    const totalParty = reqs.reduce((sum, r) => sum + (r.party_size || 1), 0);
                    return totalParty > reqs.length
                      ? `${reqs.length} people (${totalParty} total) coming`
                      : `${reqs.length} people coming`;
                  })()
                : 'See who\'s coming'}
            </Text>
            {isExpanded ? (
              <ChevronUp size={16} color={colors.accent} />
            ) : (
              <ChevronDown size={16} color={colors.accent} />
            )}
          </TouchableOpacity>
        )}

        {isOwner && isExpanded && (
          <View style={styles.requestsList}>
            {reqs.length === 0 ? (
              <Text style={styles.noRequestsText}>No requests yet</Text>
            ) : (
              reqs.map((req) => {
                const rName = req.requester?.display_name || req.requester?.username || 'User';
                const rInitials = rName.slice(0, 2).toUpperCase();
                const rColor = req.requester?.avatar_color || '#6AADE4';
                return (
                  <View key={req.id} style={styles.requesterRow}>
                    <View style={[styles.requesterAvatar, { backgroundColor: rColor }]}>
                      <Text style={styles.requesterAvatarText}>{rInitials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.requesterNameRow}>
                        <Text style={styles.requesterName}>{rName}</Text>
                        {(req.party_size || 1) > 1 && (
                          <Text style={styles.requesterDetail}>{'\u{1F465}'} {req.party_size}</Text>
                        )}
                        {req.eta && (
                          <Text style={styles.requesterDetail}>~{req.eta}</Text>
                        )}
                      </View>
                      {req.dietary_notes ? (
                        <Text style={styles.requesterDietary} numberOfLines={1}>{req.dietary_notes}</Text>
                      ) : null}
                      <View style={styles.requesterBottomRow}>
                        <Text style={styles.requesterStatus}>
                          {req.status === 'confirmed' ? 'Confirmed' : req.status === 'declined' ? 'Declined' : 'Pending'}
                        </Text>
                        {req.confirmation_code && (
                          <Text style={styles.requesterCode}>{req.confirmation_code}</Text>
                        )}
                      </View>
                    </View>
                    {req.status === 'pending' && (
                      <View style={styles.requesterActions}>
                        <TouchableOpacity
                          style={styles.confirmReqBtn}
                          onPress={() => handleConfirmRequest(req.id, post.id)}
                        >
                          <UserCheck size={14} color="#22C55E" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineReqBtn}
                          onPress={() => handleDeclineRequest(req.id, post.id)}
                        >
                          <UserX size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [styles, colors, currentUserId, handleGetDirections, handleDeactivate, myRequests, expandedPostId, expandedRequests, postRequests, openAcceptModal, handleLoadRequests, handleConfirmRequest, handleDeclineRequest]);

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
        ref={flatListRef}
        data={loading ? [] : posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 500);
        }}
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

              {/* Photo upload */}
              <Text style={styles.fieldLabel}>Add a photo *</Text>
              {imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageUri(null)}>
                    <X size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtonsRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                    <Camera size={18} color={colors.accent} />
                    <Text style={styles.photoBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                    <ImageIcon size={18} color={colors.accent} />
                    <Text style={styles.photoBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}

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

      {/* Accept Form Modal */}
      <Modal visible={!!acceptModalPostId} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>I'm Coming!</Text>
              <TouchableOpacity onPress={closeAcceptModal}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Party size stepper */}
              <Text style={styles.fieldLabel}>Party size</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, acceptPartySize <= 1 && styles.stepperBtnDisabled]}
                  onPress={() => setAcceptPartySize(Math.max(1, acceptPartySize - 1))}
                  disabled={acceptPartySize <= 1}
                >
                  <Text style={styles.stepperBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{acceptPartySize}</Text>
                <TouchableOpacity
                  style={[styles.stepperBtn, acceptPartySize >= 5 && styles.stepperBtnDisabled]}
                  onPress={() => setAcceptPartySize(Math.min(5, acceptPartySize + 1))}
                  disabled={acceptPartySize >= 5}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* ETA chips */}
              <Text style={styles.fieldLabel}>Estimated arrival</Text>
              <View style={styles.chipRow}>
                {ETA_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, acceptEta === opt && styles.chipActive]}
                    onPress={() => setAcceptEta(acceptEta === opt ? null : opt)}
                  >
                    <Text style={[styles.chipText, acceptEta === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dietary notes */}
              <Text style={styles.fieldLabel}>Any allergies or preferences? (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Nut allergy, vegetarian"
                placeholderTextColor={colors.placeholder}
                value={acceptDietaryNotes}
                onChangeText={setAcceptDietaryNotes}
                maxLength={200}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.acceptSubmitBtn, acceptSubmitting && styles.submitBtnDisabled]}
                onPress={handleAcceptSubmit}
                disabled={acceptSubmitting}
              >
                {acceptSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm I'm Coming</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Code Modal */}
      <Modal visible={!!confirmationCode} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmCheckCircle}>
              <Check size={32} color="#FFF" />
            </View>
            <Text style={styles.confirmTitle}>You're confirmed!</Text>
            <Text style={styles.confirmCodeDisplay}>{confirmationCode}</Text>
            <Text style={styles.confirmHint}>Show this code to the food poster</Text>
            <TouchableOpacity
              style={styles.confirmDoneBtn}
              onPress={() => setConfirmationCode(null)}
            >
              <Text style={styles.confirmDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    width: 44,
    height: 44,
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
    width: 44,
    height: 44,
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
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // Compact preview with image background
  cardPreview: {
    height: 90,
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: colors.inputBg,
  },
  cardPreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countdownChipText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  ownerTag: {
    backgroundColor: 'rgba(65,143,222,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ownerTagText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  cardPreviewBottom: { gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLocation: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', maxWidth: 140 },
  cardDot: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  cardPoster: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },

  // Expanded body
  expandedBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  detailTime: { fontSize: 11, color: colors.textMuted },
  expandedBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  postEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postEmoji: { fontSize: 22 },
  postTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  postPoster: { fontSize: 12, fontWeight: '500', color: colors.textTertiary },

  foodTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  foodTypeBadgeText: { fontSize: 10, fontWeight: '700', color: '#22C55E' },

  postDescription: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },

  postActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 8 },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#418FDE',
  },
  directionsBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  goneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
  },
  goneBtnText: { fontSize: 12, fontWeight: '700', color: colors.error },

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

  // Photo upload in modal
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  imagePreviewWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 14,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Accept/confirm flow
  comingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  comingBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  confirmCodeBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  confirmCodeBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  pendingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  declinedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  declinedBadgeText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  requestCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    marginHorizontal: 14,
  },
  requestCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  requestsList: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  noRequestsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  requesterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  requesterAvatarText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  requesterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  requesterName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  requesterDetail: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  requesterDietary: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  requesterBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  requesterStatus: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  requesterCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.5,
  },
  requesterActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  confirmReqBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineReqBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Accept form modal
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.3,
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  stepperValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  acceptSubmitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    marginTop: 20,
    marginBottom: 12,
  },

  // Confirmation code modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  confirmCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  confirmCodeDisplay: {
    fontSize: 28,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 2,
    paddingVertical: 8,
  },
  confirmHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  confirmDoneBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary || '#418FDE',
    marginTop: 8,
  },
  confirmDoneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
