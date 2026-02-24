import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  MapPin,
  Clock,
  Users,
  Calendar,
  Plus,
  Bookmark,
  Pizza,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsService } from '../services/events.service';
import { freeFoodService } from '../services/freefood.service';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';
import { useDemo } from '../context/DemoContext';
import { withOpacity } from '../utils/safeColor';
import SmartIcon from '../components/SmartIcon';
import { getEventIcon } from '../config/clubLogos';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.75);
const FILTERS_STORAGE_KEY = 'jumbonow_home_filters';

// Fallback background images for featured events without their own image
const FEATURED_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80', // conference crowd
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&q=80', // graduation caps
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80', // colorful lights event
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80', // concert crowd
  'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&q=80', // party confetti
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80', // event setup
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=600&q=80', // campus quad
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=80', // lecture hall
];

const EVENT_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'student_org', label: 'Student Orgs' },
  { id: 'arts_culture', label: 'Arts & Culture' },
  { id: 'sports', label: 'Sports' },
  { id: 'academic', label: 'Academic' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'campus_center', label: 'Campus Center' },
  { id: 'greek_life', label: 'Greek Life' },
];

const QUICK_FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'friends', label: "Friends' Events" },
  { id: 'this_week', label: 'This Week' },
  { id: 'free', label: 'Free Events' },
  { id: 'student_org', label: 'Student Orgs' },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isDemoMode, demoProfile, demoEvents } = useDemo();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [accountType, setAccountType] = useState('student');
  const [quickFilter, setQuickFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedEvents, setSavedEvents] = useState(new Set());
  const [showFabMenu, setShowFabMenu] = useState(false);
  const isFirstLoad = useRef(true);
  const filtersLoaded = useRef(false);

  // Fetch account type for role-specific UI
  useEffect(() => {
    if (isDemoMode && demoProfile) {
      setAccountType(demoProfile.account_type);
    } else {
      authService.getCurrentProfile().then((profile) => {
        if (profile?.account_type) setAccountType(profile.account_type);
      }).catch(() => {});
    }
  }, [isDemoMode, demoProfile]);

  // Entrance animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.spring(fabScale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  // Load saved/bookmarked events
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const ids = await eventsService.getSavedEventIds();
        setSavedEvents(new Set(ids));
      } catch (_) {
        // Fallback: load from local storage
        try {
          const local = await AsyncStorage.getItem('jumbonow_saved_events');
          if (local) setSavedEvents(new Set(JSON.parse(local)));
        } catch (__) {}
      }
    };
    loadSaved();
  }, []);

  const savedRef = useRef(savedEvents);
  savedRef.current = savedEvents;
  const toggleSaveEvent = useCallback(async (eventId) => {
    const isSaved = savedRef.current.has(eventId);
    // Optimistic update
    setSavedEvents((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(eventId);
      else next.add(eventId);
      AsyncStorage.setItem('jumbonow_saved_events', JSON.stringify([...next])).catch(() => {});
      return next;
    });
    try {
      if (isSaved) {
        await eventsService.leaveEvent(eventId);
      } else {
        await eventsService.joinEvent(eventId);
      }
    } catch (_) {
      // Revert on failure
      setSavedEvents((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  }, []);

  // Memoized saved IDs for stable renderItem
  const savedEventIds = useMemo(() => savedEvents, [savedEvents]);

  // Free food active count
  const [activeFoodCount, setActiveFoodCount] = useState(0);

  useEffect(() => {
    freeFoodService.getActiveCount().then(setActiveFoodCount).catch(() => {});
    const channel = freeFoodService.subscribeToPostChanges(() => {
      freeFoodService.getActiveCount().then(setActiveFoodCount).catch(() => {});
    });
    return () => { channel?.unsubscribe(); };
  }, []);

  // Load saved filters from AsyncStorage on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.quickFilter) setQuickFilter(parsed.quickFilter);
          if (parsed.categoryFilter) setCategoryFilter(parsed.categoryFilter);
        }
      } catch (_) {
        // Ignore load errors, use defaults
      } finally {
        filtersLoaded.current = true;
      }
    };
    loadFilters();
  }, []);

  // Save filters to AsyncStorage when they change
  useEffect(() => {
    if (!filtersLoaded.current) return;
    const saveFilters = async () => {
      try {
        await AsyncStorage.setItem(
          FILTERS_STORAGE_KEY,
          JSON.stringify({ quickFilter, categoryFilter })
        );
      } catch (_) {
        // Ignore save errors
      }
    };
    saveFilters();
  }, [quickFilter, categoryFilter]);

  const fetchEvents = useCallback(async (pageNum = 0) => {
    // In demo mode, use mock events
    if (isDemoMode) {
      const featured = demoEvents.filter((e) => e.is_featured);
      setEvents(demoEvents);
      setFeaturedEvents(featured);
      setHasMore(false);
      setLoadingEvents(false);
      setLoadingMore(false);
      return;
    }

    try {
      setError(null);

      // Friends filter: use dedicated RPC path
      if (quickFilter === 'friends') {
        if (pageNum === 0) {
          const [friendsEvents, featured] = await Promise.all([
            eventsService.getFriendsEvents({ page: pageNum }),
            eventsService.getFeaturedEvents(),
          ]);
          setEvents(friendsEvents);
          setFeaturedEvents(featured);
          setHasMore(friendsEvents.length >= 20);
        } else {
          const friendsEvents = await eventsService.getFriendsEvents({ page: pageNum });
          setEvents((prev) => [...prev, ...friendsEvents]);
          if (friendsEvents.length < 20) setHasMore(false);
        }
        return;
      }

      const filterOpts = { page: pageNum };
      if (categoryFilter !== 'all') {
        filterOpts.eventType = categoryFilter;
      }
      if (quickFilter === 'free') {
        filterOpts.isFree = true;
      } else if (quickFilter === 'this_week') {
        filterOpts.timeRange = 'this_week';
      } else if (quickFilter === 'student_org') {
        filterOpts.eventType = 'student_org';
      }

      if (pageNum === 0) {
        const [allEvents, featured] = await Promise.all([
          eventsService.getEventsByFilters(filterOpts),
          eventsService.getFeaturedEvents(),
        ]);
        setEvents(allEvents);
        setFeaturedEvents(featured);
        setHasMore(allEvents.length >= 20);
      } else {
        const moreEvents = await eventsService.getEventsByFilters(filterOpts);
        setEvents((prev) => [...prev, ...moreEvents]);
        if (moreEvents.length < 20) {
          setHasMore(false);
        }
      }
    } catch (err) {
      setError('Failed to load events. Pull down to retry.');
    } finally {
      setLoadingEvents(false);
      setLoadingMore(false);
    }
  }, [quickFilter, categoryFilter, isDemoMode, demoEvents]);

  // Reset page and reload when filters change
  useEffect(() => {
    if (isFirstLoad.current) {
      setLoadingEvents(true);
      isFirstLoad.current = false;
    }
    setPage(0);
    setHasMore(true);
    fetchEvents(0);
    const sub = eventsService.subscribeToEvents(() => {
      setPage(0);
      setHasMore(true);
      fetchEvents(0);
    });
    return () => { sub?.unsubscribe(); };
  }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await fetchEvents(0);
    setRefreshing(false);
  }, [fetchEvents]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loadingEvents) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    fetchEvents(nextPage);
  }, [hasMore, loadingMore, loadingEvents, page, fetchEvents]);

  const keyExtractor = useCallback((item) => item.id, []);

  const renderEventCard = useCallback(({ item: event }) => {
    const start = new Date(event.start_time);
    const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const isFree = event.ticket_price === 0 || event.ticket_price === null;
    const spotsUsed = event.attendee_count || 0;
    const spotsTotal = event.max_capacity || 100;
    const spotsRemaining = Math.max(0, spotsTotal - spotsUsed);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
        activeOpacity={0.85}
        accessibilityLabel={`Event: ${event.title}, ${dateStr} at ${timeStr}, ${isFree ? 'Free' : `$${event.ticket_price}`}`}
        accessibilityRole="button"
      >
        {/* Bookmark — fixed top-right */}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={() => toggleSaveEvent(event.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={savedEvents.has(event.id) ? `Unsave ${event.title}` : `Save ${event.title}`}
          accessibilityRole="button"
        >
          <Bookmark
            size={17}
            color={savedEvents.has(event.id) ? colors.accent : colors.textTertiary}
            fill={savedEvents.has(event.id) ? colors.accent : 'none'}
          />
        </TouchableOpacity>

        {/* RSVP / Buy — fixed bottom-right */}
        <TouchableOpacity
          style={[styles.rsvpButton, isFree ? styles.rsvpFreeButton : styles.rsvpPaidButton]}
          onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
          accessibilityLabel={isFree ? `RSVP for ${event.title}` : `Buy ticket for ${event.title}`}
          accessibilityRole="button"
        >
          <Text style={styles.rsvpButtonText}>{isFree ? 'RSVP' : 'Buy'}</Text>
        </TouchableOpacity>

        {/* Row 1: Icon + Title + Organizer */}
        <View style={styles.eventTopRow}>
          <View style={[styles.eventIconWrap, { backgroundColor: withOpacity(event.color, '20', colors.accent) }]}>
            <SmartIcon value={getEventIcon(event)} size={28} borderRadius={10} />
          </View>
          <View style={styles.eventTitleBlock}>
            <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
            <View style={styles.organizerRow}>
              <Text style={styles.eventOrganizer} numberOfLines={1}>
                {event.organizer_name || 'Tufts University'}
              </Text>
              {event.visibility === 'friends_only' && (
                <View style={styles.friendsOnlyBadge}>
                  <Text style={styles.friendsOnlyBadgeText}>Friends Only</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Row 2: Date, Time, Price tag */}
        <View style={styles.eventMeta}>
          <View style={styles.eventMetaItem}>
            <Calendar size={11} color={colors.textTertiary} />
            <Text style={styles.eventMetaText}>{dateStr}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Clock size={11} color={colors.textTertiary} />
            <Text style={styles.eventMetaText}>{timeStr}</Text>
          </View>
          {isFree ? (
            <View style={styles.priceTagFree}>
              <Text style={styles.priceTagFreeText}>Free</Text>
            </View>
          ) : (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>${event.ticket_price}</Text>
            </View>
          )}
        </View>

        {/* Row 3: Location, Spots */}
        <View style={styles.eventMeta}>
          <View style={[styles.eventMetaItem, { flex: 1 }]}>
            <MapPin size={11} color={colors.textTertiary} />
            <Text style={styles.eventMetaText} numberOfLines={1}>{event.location}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Users size={11} color={colors.textTertiary} />
            <Text style={styles.eventMetaText}>{spotsRemaining} left</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, colors, navigation, savedEventIds, toggleSaveEvent]);

  const ListEmptyComponent = useMemo(() => {
    if (loadingEvents) {
      return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Calendar size={40} color={colors.accentMuted} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setLoadingEvents(true); fetchEvents(0); }}
            accessibilityLabel="Retry loading events"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Calendar size={40} color={colors.accentMuted} />
        <Text style={styles.emptyTitle}>No events found</Text>
        <Text style={styles.emptySubtext}>Try a different filter or check back later</Text>
      </View>
    );
  }, [loadingEvents, error, colors, styles, fetchEvents]);

  const ListFooterComponent = useMemo(() => {
    if (loadingMore) {
      return (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
      );
    }
    return null;
  }, [loadingMore, colors]);

  const ListHeaderComponent = useMemo(() => (
    <>
      {/* Featured Events Carousel */}
      <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}>
        {featuredEvents.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Featured Events</Text>
              {activeFoodCount > 0 && (
                <TouchableOpacity
                  style={styles.freeFoodChip}
                  onPress={() => navigation.navigate('FreeFood')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.freeFoodChipEmoji}>{'\u{1F355}'}</Text>
                  <Text style={styles.freeFoodChipBadgeText}>{activeFoodCount}</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
            >
              {featuredEvents.map((event, index) => {
                const start = new Date(event.start_time);
                const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const isFree = event.ticket_price === 0 || event.ticket_price === null;
                const imageUrl = event.image_url || FEATURED_FALLBACK_IMAGES[index % FEATURED_FALLBACK_IMAGES.length];
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.featuredCard}
                    onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                    activeOpacity={0.85}
                    accessibilityLabel={`Featured event: ${event.title}, ${dateStr}, ${isFree ? 'Free' : `$${event.ticket_price}`}`}
                    accessibilityRole="button"
                  >
                    <Image source={{ uri: imageUrl }} style={styles.featuredPoster} resizeMode="cover" />
                    <View style={styles.featuredOverlay} />
                    <View style={styles.featuredBadgeRow}>
                      {isFree ? (
                        <View style={[styles.priceBadge, styles.freeBadge]}>
                          <Text style={styles.freeBadgeText}>Free</Text>
                        </View>
                      ) : (
                        <View style={styles.priceBadge}>
                          <Text style={styles.priceBadgeText}>${event.ticket_price}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.featuredMeta}>
                      <Calendar size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.featuredMetaText}>{dateStr}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {QUICK_FILTERS.filter((f) => !(accountType === 'club' && f.id === 'friends')).map((f) => {
            const isActive = quickFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  if (isActive) {
                    setQuickFilter('all');
                  } else {
                    setQuickFilter(f.id);
                    if (f.id === 'student_org') setCategoryFilter('all');
                  }
                }}
                accessibilityLabel={`Filter: ${f.label}${isActive ? ', selected' : ''}`}
                accessibilityRole="button"
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Grid */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {EVENT_CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => {
                  if (isActive) {
                    setCategoryFilter('all');
                  } else {
                    setCategoryFilter(cat.id);
                    if (cat.id !== 'all' && quickFilter === 'student_org') setQuickFilter('all');
                  }
                }}
                accessibilityLabel={`Category: ${cat.label}${isActive ? ', selected' : ''}`}
                accessibilityRole="button"
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  ), [styles, colors, featuredEvents, quickFilter, categoryFilter, navigation, activeFoodCount, accountType]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Fixed Header */}
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTop}>
            <Image
              source={require('../../assets/jumbo-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
              accessibilityLabel="JumboNow logo"
            />
            <View style={styles.headerBrand}>
              <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {accountType === 'club' ? 'Club Dashboard' : accountType === 'staff' ? 'Staff Hub' : 'Campus Life'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {accountType === 'club' ? 'Manage your events & reach' : accountType === 'staff' ? 'University events & resources' : 'Tufts University Events'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="View notifications"
              accessibilityRole="button"
            >
              <Bell size={22} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        data={loadingEvents || error ? [] : events}
        keyExtractor={keyExtractor}
        renderItem={renderEventCard}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      />

      {/* FAB dropdown menu backdrop */}
      {showFabMenu && (
        <TouchableOpacity
          style={styles.fabBackdrop}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}

      {/* FAB menu options */}
      {showFabMenu && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setShowFabMenu(false); navigation.navigate('CreateEvent'); }}
            activeOpacity={0.8}
          >
            <Calendar size={16} color={colors.accent} />
            <Text style={styles.fabMenuText}>
              {accountType === 'club' ? 'Create Club Event' : accountType === 'staff' ? 'Create Campus Event' : 'Create Event'}
            </Text>
          </TouchableOpacity>
          {accountType === 'club' && (
            <>
              <View style={styles.fabMenuDivider} />
              <TouchableOpacity
                style={styles.fabMenuItem}
                onPress={() => { setShowFabMenu(false); navigation.navigate('MyTickets'); }}
                activeOpacity={0.8}
              >
                <Users size={16} color="#8B5CF6" />
                <Text style={styles.fabMenuText}>My Events & Attendees</Text>
              </TouchableOpacity>
            </>
          )}
          {accountType === 'staff' && (
            <>
              <View style={styles.fabMenuDivider} />
              <TouchableOpacity
                style={styles.fabMenuItem}
                onPress={() => { setShowFabMenu(false); navigation.navigate('CampusResources'); }}
                activeOpacity={0.8}
              >
                <MapPin size={16} color="#3579C6" />
                <Text style={styles.fabMenuText}>Campus Resources</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.fabMenuDivider} />
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setShowFabMenu(false); navigation.navigate('FreeFood'); }}
            activeOpacity={0.8}
          >
            <Pizza size={16} color="#22C55E" />
            <Text style={styles.fabMenuText}>Free Food</Text>
            {activeFoodCount > 0 && (
              <View style={styles.fabFoodBadge}>
                <Text style={styles.fabFoodBadgeText}>{activeFoodCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* FAB button */}
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowFabMenu((v) => !v)}
          activeOpacity={0.85}
          accessibilityLabel="Create"
          accessibilityRole="button"
        >
          <Plus size={26} color="#FFF" style={showFabMenu ? { transform: [{ rotate: '45deg' }] } : undefined} />
        </TouchableOpacity>
      </Animated.View>

      <BottomNav navigation={navigation} activeTab="Home" />
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },

  // -- Header (fixed) --
  header: {
    backgroundColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerBrand: {
    flex: 1,
    alignItems: 'center',
  },
  headerLogo: {
    width: 52,
    height: 52,
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // -- Featured --
  featuredSection: { marginBottom: 8, marginTop: 10 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  featuredScroll: { paddingHorizontal: 20, gap: 14 },
  featuredCard: {
    width: FEATURED_CARD_WIDTH, height: 170, borderRadius: 20, padding: 18, justifyContent: 'flex-end', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  featuredPoster: { ...StyleSheet.absoluteFillObject },
  featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  featuredBadgeRow: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  priceBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  freeBadge: { backgroundColor: 'rgba(34,197,94,0.35)' },
  freeBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  priceBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  featuredIcon: { fontSize: 32, marginBottom: 6 },
  featuredTitle: { color: '#FFF', fontSize: 17, fontWeight: '900', marginBottom: 6 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  featuredMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },

  // -- Filters --
  filtersContainer: { paddingHorizontal: 20, gap: 8, marginTop: 6, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, flexShrink: 0,
  },
  filterChipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  filterChipText: { color: colors.textTertiary, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: '#FFF' },

  // -- Categories --
  categoriesContainer: { paddingHorizontal: 20, gap: 8, marginBottom: 18 },
  categoryChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    flexDirection: 'row', gap: 6, flexShrink: 0,
  },
  categoryChipActive: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  categoryText: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: colors.accent },

  // -- Event cards --
  eventCard: {
    marginHorizontal: 20, marginBottom: 12, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    gap: 8, position: 'relative',
  },
  eventTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 36 },
  eventIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventIcon: { fontSize: 19 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventTitleBlock: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  eventOrganizer: { color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginTop: 2 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 80 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventMetaText: { color: colors.textTertiary, fontSize: 11, fontWeight: '500' },
  bookmarkBtn: { position: 'absolute', top: 14, right: 16, zIndex: 2, padding: 4 },
  rsvpButton: { position: 'absolute', bottom: 14, right: 16, zIndex: 2, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  rsvpFreeButton: { backgroundColor: colors.success },
  rsvpPaidButton: { backgroundColor: colors.buttonPrimary },
  rsvpButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  priceTagFree: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.success + '26' },
  priceTagFreeText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  priceTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.accentBg },
  priceTagText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  friendsOnlyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(139,92,246,0.15)' },
  friendsOnlyBadgeText: { color: '#8B5CF6', fontSize: 9, fontWeight: '800' },

  // -- Free Food Chip (inline with section title, only when active) --
  freeFoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.success + '24',
  },
  freeFoodChipEmoji: { fontSize: 11 },
  freeFoodChipBadgeText: { color: colors.success, fontSize: 11, fontWeight: '800' },

  // -- Empty / FAB --
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 155,
    right: 20,
    backgroundColor: colors.headerBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  fabMenuText: { fontSize: 14, fontWeight: '700', color: colors.text },
  fabFoodBadge: {
    backgroundColor: colors.success,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  fabFoodBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  fabMenuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder },
  fabWrap: { position: 'absolute', bottom: 90, right: 20, zIndex: 12 },
  fab: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
});
