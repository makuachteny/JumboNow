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
  Calendar,
  Pizza,
  Search,
  Map,
  ChevronRight,
  Star,
  Share2,
  MessageCircle,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsService } from '../services/events.service';
import { freeFoodService } from '../services/freefood.service';
import { groupChatService } from '../services/groupChat.service';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.64);
const POSTER_IMAGE_HEIGHT = 240;
const WEEKEND_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.42);
const WEEKEND_IMAGE_HEIGHT = 300;
const CONV_CARD_WIDTH = SCREEN_WIDTH - 60;
const FILTERS_STORAGE_KEY = 'jumbonow_home_filters';

const FEATURED_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
  'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&q=80',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=600&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=80',
];

const EVENT_CATEGORIES = [
  { id: 'student_org', label: 'Student Orgs', icon: '\uD83D\uDC9C' },
  { id: 'arts_culture', label: 'Arts & Culture', icon: '\uD83C\uDFAD' },
  { id: 'sports', label: 'Sports', icon: '\uD83C\uDFC0' },
  { id: 'academic', label: 'Academic', icon: '\uD83D\uDCDA' },
  { id: 'outdoors', label: 'Outdoors', icon: '\uD83C\uDF3F' },
  { id: 'campus_center', label: 'Campus Center', icon: '\uD83C\uDFEB' },
  { id: 'greek_life', label: 'Greek Life', icon: '\uD83C\uDFDB\uFE0F' },
  { id: 'clubs', label: 'Clubs', icon: '\uD83C\uDFAA' },
  { id: 'social', label: 'Social', icon: '\uD83E\uDD1D' },
  { id: 'community', label: 'Community', icon: '\uD83C\uDF0D' },
  { id: 'wellness', label: 'Wellness', icon: '\uD83E\uDDD8' },
  { id: 'career', label: 'Career', icon: '\uD83D\uDCBC' },
  { id: 'food_drink', label: 'Food & Drink', icon: '\uD83C\uDF55' },
  { id: 'music', label: 'Music', icon: '\uD83C\uDFB5' },
  { id: 'tech', label: 'Tech', icon: '\uD83D\uDCBB' },
];

const QUICK_FILTERS = [
  { id: 'all', label: 'All Events', icon: '\u2728' },
  { id: 'tonight', label: 'Tonight', icon: '\uD83C\uDF19' },
  { id: 'tomorrow', label: 'Tomorrow', icon: '\u2600\uFE0F' },
  { id: 'this_week', label: 'This Week', icon: '\uD83D\uDCC5' },
  { id: 'this_weekend', label: 'This Weekend', icon: '\uD83C\uDF89' },
  { id: 'free', label: 'Free Events', icon: '\uD83C\uDF9F\uFE0F' },
  { id: 'popular', label: 'Popular', icon: '\uD83D\uDD25' },
  { id: 'friends', label: "Friends' Events", icon: '\uD83D\uDC65' },
  { id: 'near_campus', label: 'Near Campus', icon: '\uD83D\uDCCD' },
  { id: 'just_added', label: 'Just Added', icon: '\uD83C\uDD95' },
];

const DAY_ABBRS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function getWeekDays() {
  const today = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({ abbr: DAY_ABBRS[d.getDay()], date: d.getDate(), isToday: i === 0, fullDate: d.toISOString().split('T')[0] });
  }
  return days;
}

function formatEventTime(startTime) {
  const start = new Date(startTime);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (start.toDateString() === today.toDateString()) return `Today at ${timeStr}`;
  if (start.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${timeStr}`;
  const dayName = start.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dayName} at ${timeStr}`;
}

function formatDateRange(event) {
  const start = new Date(event.start_time);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  let str = start.toLocaleDateString('en-US', opts);
  if (event.end_time) {
    const end = new Date(event.end_time);
    if (end.toDateString() !== start.toDateString()) {
      str += ' \u2013 ' + end.toLocaleDateString('en-US', opts);
    }
  }
  return str;
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [accountType, setAccountType] = useState('student');
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0]);
  const [conversations, setConversations] = useState([]);
  const [activeConvPage, setActiveConvPage] = useState(0);
  const isFirstLoad = useRef(true);
  const filtersLoaded = useRef(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

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
    ]).start();
  }, []);

  useEffect(() => {
    authService.getCurrentProfile().then((profile) => {
      if (profile?.account_type) setAccountType(profile.account_type);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const ids = await eventsService.getSavedEventIds();
        setSavedEvents(new Set(ids));
      } catch (_) {
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
    setSavedEvents((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(eventId);
      else next.add(eventId);
      AsyncStorage.setItem('jumbonow_saved_events', JSON.stringify([...next])).catch(() => {});
      return next;
    });
    try {
      if (isSaved) await eventsService.leaveEvent(eventId);
      else await eventsService.joinEvent(eventId);
    } catch (_) {
      setSavedEvents((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  }, []);



  const [activeFoodCount, setActiveFoodCount] = useState(0);

  useEffect(() => {
    freeFoodService.getActiveCount().then(setActiveFoodCount).catch(() => {});
    const channel = freeFoodService.subscribeToPostChanges(() => {
      freeFoodService.getActiveCount().then(setActiveFoodCount).catch(() => {});
    });
    return () => { channel?.unsubscribe(); };
  }, []);

  useEffect(() => {
    groupChatService.getGroupConversations()
      .then((convos) => setConversations(convos || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.quickFilter) setQuickFilter(parsed.quickFilter);
          if (parsed.categoryFilter) setCategoryFilter(parsed.categoryFilter);
        }
      } catch (_) {}
      finally { filtersLoaded.current = true; }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    if (!filtersLoaded.current) return;
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ quickFilter, categoryFilter })).catch(() => {});
  }, [quickFilter, categoryFilter]);

  const fetchEvents = useCallback(async (pageNum = 0) => {
    try {
      setError(null);
      if (quickFilter === 'friends') {
        if (pageNum === 0) {
          const [friendsEvents, featured] = await Promise.all([
            eventsService.getFriendsEvents({ page: pageNum }),
            eventsService.getFeaturedEvents(),
          ]);
          setEvents(friendsEvents.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
          setFeaturedEvents(featured);
          setHasMore(friendsEvents.length >= 20);
        } else {
          const friendsEvents = await eventsService.getFriendsEvents({ page: pageNum });
          setEvents((prev) => [...prev, ...friendsEvents].sort((a, b) => (a.title || '').localeCompare(b.title || '')));
          if (friendsEvents.length < 20) setHasMore(false);
        }
        return;
      }
      const filterOpts = { page: pageNum };
      if (categoryFilter !== 'all') filterOpts.eventType = categoryFilter;
      if (selectedDay) filterOpts.date = selectedDay;
      if (quickFilter === 'free') filterOpts.isFree = true;
      else if (quickFilter === 'tonight') filterOpts.timeRange = 'tonight';
      else if (quickFilter === 'tomorrow') filterOpts.timeRange = 'tomorrow';
      else if (quickFilter === 'this_week') filterOpts.timeRange = 'this_week';
      else if (quickFilter === 'this_weekend') filterOpts.timeRange = 'this_weekend';
      else if (quickFilter === 'popular') filterOpts.sort = 'popular';
      else if (quickFilter === 'near_campus') filterOpts.nearCampus = true;
      else if (quickFilter === 'just_added') filterOpts.sort = 'newest';
      else if (quickFilter === 'student_org') filterOpts.eventType = 'student_org';
      if (pageNum === 0) {
        const [allEvents, featured] = await Promise.all([
          eventsService.getEventsByFilters(filterOpts),
          eventsService.getFeaturedEvents(),
        ]);
        setEvents(allEvents.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
        setFeaturedEvents(featured);
        setHasMore(allEvents.length >= 20);
      } else {
        const moreEvents = await eventsService.getEventsByFilters(filterOpts);
        setEvents((prev) => [...prev, ...moreEvents].sort((a, b) => (a.title || '').localeCompare(b.title || '')));
        if (moreEvents.length < 20) setHasMore(false);
      }
    } catch (err) {
      setError('Failed to load events. Pull down to retry.');
    } finally {
      setLoadingEvents(false);
      setLoadingMore(false);
    }
  }, [quickFilter, categoryFilter, selectedDay]);

  useEffect(() => {
    if (isFirstLoad.current) { setLoadingEvents(true); isFirstLoad.current = false; }
    setPage(0);
    setHasMore(true);
    fetchEvents(0);
    const sub = eventsService.subscribeToEvents(() => { setPage(0); setHasMore(true); fetchEvents(0); });
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

  // Hot & new events
  const hotNewEvents = useMemo(() =>
    featuredEvents.length > 0 ? featuredEvents.slice(0, 8) : events.slice(0, 8),
    [featuredEvents, events]
  );

  // Weekend events
  const weekendEvents = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const fri = new Date(now);
    fri.setDate(now.getDate() + ((5 - day + 7) % 7));
    fri.setHours(0, 0, 0, 0);
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    sun.setHours(23, 59, 59, 999);
    return events.filter(e => {
      const s = new Date(e.start_time);
      return s >= fri && s <= sun;
    }).slice(0, 10);
  }, [events]);

  // Day picker
  const weekDays = useMemo(() => getWeekDays(), []);

  // This week events filtered by selected day
  const thisWeekDayEvents = useMemo(() => {
    if (!selectedDay) return events.slice(0, 6);
    return events.filter(e => {
      const d = new Date(e.start_time).toISOString().split('T')[0];
      return d === selectedDay;
    }).slice(0, 10);
  }, [events, selectedDay]);

  // Just added (newest first)
  const justAddedEvents = useMemo(() =>
    [...events].sort((a, b) => new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time)).slice(0, 8),
    [events]
  );

  // Popular events for Can't-miss
  const popularEvents = useMemo(() =>
    [...events].sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0)).slice(0, 8),
    [events]
  );

  // Top 20 by interest
  const top20Events = useMemo(() =>
    [...events].sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0)).slice(0, 20),
    [events]
  );


  const ListEmptyComponent = useMemo(() => {
    if (loadingEvents) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Calendar size={40} color={colors.accentMuted} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoadingEvents(true); fetchEvents(0); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [loadingEvents, error, colors, styles, fetchEvents]);

  // ── List header: all horizontal-scroll sections (Joyraft layout) ──
  const ListHeaderComponent = useMemo(() => {
    // Helper to render overlapping profile avatars
    const renderAvatars = (event, size = 24) => {
      const avatars = event.attendee_avatars || [];
      const count = event.attendee_count || 0;
      return (
        <View style={styles.attendeeDots}>
          {avatars.length > 0 ? avatars.slice(0, 3).map((p, i) => (
            p?.avatar_url
              ? <Image key={i} source={{ uri: p.avatar_url }} style={[styles.avatarDot, { width: size, height: size, borderRadius: size / 2 }, i > 0 && { marginLeft: -size / 3 }]} />
              : <View key={i} style={[styles.avatarDotFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: [colors.accent, colors.success, colors.info][i] }, i > 0 && { marginLeft: -size / 3 }]} />
          )) : (
            <>
              <View style={[styles.avatarDotFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }]} />
              {count > 1 && <View style={[styles.avatarDotFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.success, marginLeft: -size / 3 }]} />}
            </>
          )}
        </View>
      );
    };

    // Helper to render a poster card (used in Hot & new, Just added, Can't-miss, Top 20)
    const renderPosterCard = (event, index) => {
      const dateRange = formatDateRange(event);
      const imageUrl = event.image_url || FEATURED_FALLBACK_IMAGES[index % FEATURED_FALLBACK_IMAGES.length];
      const attendeeCount = event.attendee_count || 0;
      const isSaved = savedEvents.has(event.id);
      return (
        <TouchableOpacity key={event.id} style={styles.posterCard} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} activeOpacity={0.9}>
          <View style={styles.posterImageWrap}>
            <Image source={{ uri: imageUrl }} style={styles.posterImage} resizeMode="cover" />
            <View style={styles.posterCommentBubble}>
              <MessageCircle size={16} color={colors.accent} />
            </View>
          </View>
          <View style={styles.posterBody}>
            <View style={styles.posterAttendeeRow}>
              {renderAvatars(event)}
              <Text style={styles.posterAttendeeText}>{attendeeCount} interested</Text>
            </View>
            <Text style={styles.posterTitle} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.posterLocation} numberOfLines={1}>{event.location || 'Tufts Campus'}</Text>
            <Text style={styles.posterDate}>{dateRange}</Text>
            <View style={styles.posterActions}>
              <TouchableOpacity style={styles.posterInterestedBtn} onPress={() => toggleSaveEvent(event.id)}>
                <Star size={16} color={colors.accent} fill={isSaved ? colors.accent : 'none'} />
                <Text style={styles.posterInterestedText}>Interested</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.posterShareBtn}>
                <Share2 size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}>

        {/* ── 1. Hot & new 🔥 (Image 1 top) ── */}
        {hotNewEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hot & new {'\uD83D\uDD25'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterScroll}>
              {hotNewEvents.map((event, index) => renderPosterCard(event, index))}
            </ScrollView>
          </View>
        )}

        {/* ── 2. This weekend for you (Image 1 bottom) ── */}
        {weekendEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This weekend for you</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterScroll}>
              {weekendEvents.map((event, index) => {
                const imageUrl = event.image_url || FEATURED_FALLBACK_IMAGES[index % FEATURED_FALLBACK_IMAGES.length];
                const attendeeCount = event.attendee_count || 0;
                return (
                  <TouchableOpacity key={event.id} style={styles.weekendCard} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} activeOpacity={0.9}>
                    <View style={styles.weekendImageWrap}>
                      <Image source={{ uri: imageUrl }} style={styles.weekendImage} resizeMode="cover" />
                    </View>
                    <View style={styles.weekendBody}>
                      <View style={styles.posterAttendeeRow}>
                        {renderAvatars(event)}
                        <Text style={styles.posterAttendeeText}>{attendeeCount} interested</Text>
                      </View>
                      <Text style={styles.posterTitle} numberOfLines={1}>{event.title}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── 3. This week 📅 (Image 2 top) — day picker + landscape cards ── */}
        <View style={styles.section}>
          <View style={styles.thisWeekHeader}>
            <Text style={styles.sectionTitle}>This week {'\uD83D\uDCC5'}</Text>
            <TouchableOpacity onPress={() => setSelectedDay(weekDays[0]?.fullDate || null)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.todayEventsLink}>Today's events</Text>
                <ChevronRight size={14} color={colors.accent} />
              </View>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPickerScroll}>
            {weekDays.map((day) => (
              <TouchableOpacity key={day.fullDate} style={styles.dayPickerItem} onPress={() => setSelectedDay(selectedDay === day.fullDate ? null : day.fullDate)}>
                <Text style={[styles.dayPickerAbbr, (selectedDay === day.fullDate || (day.isToday && !selectedDay)) && styles.dayPickerAbbrActive]}>{day.abbr}</Text>
                <View style={[styles.dayPickerDateWrap, (selectedDay === day.fullDate || (day.isToday && !selectedDay)) && styles.dayPickerDateWrapActive]}>
                  <Text style={[styles.dayPickerDate, (selectedDay === day.fullDate || (day.isToday && !selectedDay)) && styles.dayPickerDateActive]}>{day.date}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {thisWeekDayEvents.length > 0 && (
            <View style={styles.landscapeList}>
              {thisWeekDayEvents.map((event, index) => {
                const timeLabel = formatEventTime(event.start_time);
                const imageUrl = event.image_url || FEATURED_FALLBACK_IMAGES[index % FEATURED_FALLBACK_IMAGES.length];
                const attendeeCount = event.attendee_count || 0;
                const isSaved = savedEvents.has(event.id);
                return (
                  <TouchableOpacity key={event.id} style={styles.landscapeCard} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} activeOpacity={0.9}>
                    <Image source={{ uri: imageUrl }} style={styles.landscapeCardImage} resizeMode="cover" />
                    <View style={styles.landscapeCardContent}>
                      <Text style={styles.landscapeCardTitle} numberOfLines={2}>{event.title}</Text>
                      <Text style={styles.landscapeCardTime}>{timeLabel}</Text>
                      <View style={styles.posterAttendeeRow}>
                        {renderAvatars(event, 22)}
                        <Text style={styles.posterAttendeeText}>{attendeeCount} people are interested</Text>
                      </View>
                      <View style={styles.landscapeCardDivider} />
                      <View style={styles.landscapeCardActions}>
                        <TouchableOpacity style={styles.landscapeActionBtn} onPress={() => toggleSaveEvent(event.id)}>
                          <Star size={20} color={isSaved ? colors.accent : colors.textMuted} fill={isSaved ? colors.accent : 'none'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.landscapeActionBtn}>
                          <Calendar size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.landscapeActionBtn}>
                          <Share2 size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity style={styles.viewEventsBtn} onPress={() => navigation.navigate('Discover')}>
            <Search size={18} color={colors.textSecondary} />
            <Text style={styles.viewEventsBtnText}>View events this week</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── 4. Just added (Image 2 bottom) ── */}
        {justAddedEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Just added</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterScroll}>
              {justAddedEvents.map((event, index) => renderPosterCard(event, index))}
            </ScrollView>
          </View>
        )}

        {/* ── 5. Conversations 💬 (Image 3 top) ── */}
        {conversations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Conversations {'\uD83D\uDCAC'}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Friends')}>
                <Text style={styles.seeAllText}>see all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CONV_CARD_WIDTH + 14}
              decelerationRate="fast"
              contentContainerStyle={styles.convScroll}
              onScroll={(e) => {
                const pg = Math.round(e.nativeEvent.contentOffset.x / (CONV_CARD_WIDTH + 14));
                setActiveConvPage(pg);
              }}
              scrollEventThrottle={16}
            >
              {conversations.slice(0, 5).map((conv) => (
                <TouchableOpacity key={conv.id} activeOpacity={0.9} onPress={() => navigation.navigate('GroupChat', { groupConversationId: conv.id })}>
                  <LinearGradient
                    colors={['#418FDE', '#EF4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.convCardGradient}
                  >
                    <View style={[styles.convCardInner, { backgroundColor: colors.card }]}>
                      <View style={styles.convCardHeader}>
                        <View style={[styles.convAvatar, { backgroundColor: colors.accentBg }]}>
                          <MessageCircle size={18} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.convCardName} numberOfLines={1}>
                            {conv.friend_group?.name || conv.name || 'Group Chat'}
                          </Text>
                          <Text style={styles.convCardSubtext}>is looking for recommendations</Text>
                        </View>
                      </View>
                      <Text style={styles.convCardQuote} numberOfLines={3}>
                        {conv.last_message || 'Start a conversation...'}
                      </Text>
                      <View style={styles.convCardFooter}>
                        <Text style={styles.convCardCount}>
                          {conv.member_count || conv.friend_group?.member_count || 0} recommendations
                        </Text>
                        <View style={styles.convCardLink}>
                          <Text style={styles.convCardLinkText}>View full list</Text>
                          <ChevronRight size={14} color={colors.accent} />
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {conversations.length > 1 && (
              <View style={styles.paginationDots}>
                {conversations.slice(0, 5).map((_, i) => (
                  <View key={i} style={[styles.dot, activeConvPage === i && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 6. Can't-miss things to do 🎆 (Image 3 middle) ── */}
        {popularEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Can't-miss things to do {'\uD83C\uDF86'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterScroll}>
              {popularEvents.map((event, index) => renderPosterCard(event, index))}
            </ScrollView>
          </View>
        )}

        {/* ── 7. Top 20 on JumboNow (Image 3 bottom) ── */}
        {top20Events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top 20 on JumboNow</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterScroll}>
              {top20Events.slice(0, 10).map((event, index) => renderPosterCard(event, index))}
            </ScrollView>
          </View>
        )}

        {/* ── Food & drink ── */}
        {activeFoodCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Food & drink experiences</Text>
            <TouchableOpacity style={styles.foodBanner} onPress={() => navigation.navigate('FreeFood')} activeOpacity={0.85}>
              <View style={styles.foodBannerIcon}>
                <Pizza size={24} color={colors.success} />
              </View>
              <View style={styles.foodBannerContent}>
                <Text style={styles.foodBannerTitle}>
                  {activeFoodCount} free food spot{activeFoodCount !== 1 ? 's' : ''} nearby
                </Text>
                <Text style={styles.foodBannerSubtext}>Tap to see what's available now</Text>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    );
  }, [styles, colors, hotNewEvents, weekendEvents, weekDays, selectedDay, thisWeekDayEvents, justAddedEvents, navigation, activeFoodCount, savedEvents, toggleSaveEvent, conversations, activeConvPage, popularEvents, top20Events]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Fixed Header */}
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.headerTitle}>JumboNow</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Bell size={21} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Discover')}>
              <Search size={21} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Map')}>
              <Map size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        data={[]}
        keyExtractor={keyExtractor}
        renderItem={null}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      />

      <BottomNav navigation={navigation} activeTab="Home" />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // ── Sections ──
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
    marginBottom: 16,
  },
  seeAllText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Poster Cards (Image 1 — Hot & new, Just added, Can't-miss, Top 20) ──
  posterScroll: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 6,
  },
  posterCard: {
    width: POSTER_CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  posterImageWrap: {
    width: '100%',
    height: POSTER_IMAGE_HEIGHT,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterCommentBubble: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterBody: {
    padding: 14,
  },
  posterAttendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  posterTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  posterLocation: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  posterDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  posterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posterInterestedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    backgroundColor: 'transparent',
  },
  posterInterestedText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  posterShareBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterAttendeeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Avatar dots (shared) ──
  attendeeDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarDot: {
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarDotFallback: {
    borderWidth: 2,
    borderColor: colors.card,
  },

  // ── Weekend Cards (Image 1 — This weekend for you) ──
  weekendCard: {
    width: WEEKEND_CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  weekendImageWrap: {
    width: '100%',
    height: WEEKEND_IMAGE_HEIGHT,
  },
  weekendImage: {
    width: '100%',
    height: '100%',
  },
  weekendBody: {
    padding: 12,
  },

  // ── This week section (Image 2) ──
  thisWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
    marginBottom: 14,
  },
  todayEventsLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  dayPickerScroll: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  dayPickerItem: {
    alignItems: 'center',
    width: Math.round((SCREEN_WIDTH - 40) / 7),
    gap: 6,
  },
  dayPickerAbbr: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayPickerAbbrActive: {
    color: colors.accent,
  },
  dayPickerDateWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPickerDateWrapActive: {
    backgroundColor: colors.accent,
  },
  dayPickerDate: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  dayPickerDateActive: {
    color: '#FFF',
  },

  // ── Landscape Cards (Image 2 — This week events, vertical list) ──
  landscapeList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  landscapeCard: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  landscapeCardImage: {
    width: 120,
    minHeight: 160,
  },
  landscapeCardContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  landscapeCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  landscapeCardTime: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  landscapeCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: 10,
  },
  landscapeCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  landscapeActionBtn: {
    padding: 6,
  },

  // ── View events button ──
  viewEventsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    gap: 10,
  },
  viewEventsBtnText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Food & drink ──
  foodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 14,
  },
  foodBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodBannerContent: { flex: 1 },
  foodBannerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  foodBannerSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── Conversations (Image 3) ──
  convScroll: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 4,
  },
  convCardGradient: {
    width: CONV_CARD_WIDTH,
    borderRadius: 18,
    padding: 2.5,
  },
  convCardInner: {
    borderRadius: 16,
    padding: 18,
  },
  convCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  convAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convCardName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  convCardSubtext: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  convCardQuote: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  convCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convCardCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  convCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  convCardLinkText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
  },
  dotActive: {
    backgroundColor: colors.accent,
    opacity: 1,
    width: 20,
    borderRadius: 4,
  },

  // ── Empty / Retry ──
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
