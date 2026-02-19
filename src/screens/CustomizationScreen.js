import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Platform,
  UIManager,
  Linking,
  Dimensions,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Clock,
  Phone,
  Calendar,
  Shield,
  ChevronRight,
  ExternalLink,
  WifiOff,
  Star,
  MapPin,
  GraduationCap,
  Users,
  Home,
  X,
  SlidersHorizontal,
  PhoneCall,
  AlertCircle,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ORDER_KEY = 'jumbonow_tab_order';

// ── Tab definitions ──
const DEFAULT_TABS = [
  { id: 'home', label: 'Home Feed', icon: 'home', color: '#418FDE' },
  { id: 'hours', label: 'Hours', icon: 'clock', color: '#F59E0B' },
  { id: 'emergency', label: 'Emergency', icon: 'shield', color: '#EF4444' },
  { id: 'calendar', label: 'Calendar', icon: 'graduationcap', color: '#3579C6' },
  { id: 'events', label: 'Events', icon: 'calendar', color: '#6AADE4' },
  { id: 'recs', label: 'Recs', icon: 'star', color: '#EAB308' },
];

// ── Category chips per tab ──
const TAB_CATEGORIES = {
  home: [
    { id: 'all', label: 'All' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'recent', label: 'Recent' },
  ],
  hours: [
    { id: 'all', label: 'All' },
    { id: 'libraries', label: 'Libraries' },
    { id: 'dining', label: 'Dining' },
    { id: 'gyms', label: 'Gyms' },
    { id: 'academic', label: 'Academic' },
  ],
  emergency: [
    { id: 'all', label: 'All' },
    { id: 'safety', label: 'Safety' },
    { id: 'medical', label: 'Medical' },
    { id: 'support', label: 'Support' },
  ],
  calendar: [
    { id: 'all', label: 'All' },
    { id: 'deadlines', label: 'Deadlines' },
    { id: 'breaks', label: 'Breaks' },
    { id: 'ceremonies', label: 'Ceremonies' },
  ],
  events: [
    { id: 'all', label: 'All' },
    { id: 'student_orgs', label: 'Student Orgs' },
    { id: 'arts', label: 'Arts & Culture' },
    { id: 'sports', label: 'Sports' },
    { id: 'academic', label: 'Academic' },
  ],
  recs: [
    { id: 'all', label: 'All' },
    { id: 'food', label: 'Food & Drink' },
    { id: 'study', label: 'Study Spots' },
    { id: 'hangout', label: 'Hangouts' },
  ],
};

// ── Mock data ──
const MOCK_DATA = {
  hours: {
    all: [
      { name: 'Tisch Library', hours: '8 AM - 12 AM', status: 'open', category: 'libraries' },
      { name: 'Campus Center', hours: '7 AM - 11 PM', status: 'open', category: 'dining' },
      { name: 'SEC', hours: '7:30 AM - 10 PM', status: 'open', category: 'academic' },
      { name: 'Lilly Music Library', hours: '9 AM - 9 PM', status: 'open', category: 'libraries' },
      { name: 'Gantcher Center', hours: '6 AM - 10 PM', status: 'open', category: 'gyms' },
      { name: 'Dewick-MacPhie', hours: '7 AM - 8 PM', status: 'open', category: 'dining' },
      { name: 'Carmichael Hall', hours: '7 AM - 8 PM', status: 'open', category: 'dining' },
      { name: 'Aidekman Arts Center', hours: '8 AM - 10 PM', status: 'open', category: 'academic' },
      { name: 'Barnum Hall', hours: '7 AM - 9 PM', status: 'closed', category: 'academic' },
    ],
  },
  emergency: {
    all: [
      { name: 'TUPD (Non-Emergency)', phone: '(617) 627-3030', type: 'safety', icon: 'shield', priority: true },
      { name: 'Emergency Services', phone: '911', type: 'safety', icon: 'phone', priority: true },
      { name: 'Counseling & Mental Health', phone: '(617) 627-3360', type: 'medical', icon: 'heart' },
      { name: 'Health Services', phone: '(617) 627-3350', type: 'medical', icon: 'heart' },
      { name: 'Title IX Office', phone: '(617) 627-3298', type: 'support', icon: 'shield' },
      { name: 'Dean of Students', phone: '(617) 627-3158', type: 'support', icon: 'users' },
      { name: 'Facilities Services', phone: '(617) 627-3366', type: 'support', icon: 'phone' },
      { name: 'Campus Safety (after hours)', phone: '(617) 627-6911', type: 'safety', icon: 'shield', priority: true },
    ],
  },
  calendar: {
    all: [
      { name: 'Spring Break', date: '2026-03-14', type: 'break', endDate: '2026-03-22' },
      { name: 'Last Day of Classes', date: '2026-04-28', type: 'deadline' },
      { name: 'Reading Period', date: '2026-04-29', type: 'deadline', endDate: '2026-05-01' },
      { name: 'Final Exams Begin', date: '2026-05-02', type: 'deadline' },
      { name: 'Final Exams End', date: '2026-05-11', type: 'deadline' },
      { name: 'Commencement', date: '2026-05-17', type: 'ceremony' },
      { name: 'Summer Session I Begins', date: '2026-05-27', type: 'deadline' },
    ],
  },
  events: {
    all: [
      { title: 'Jazz Ensemble Concert', date: '2026-02-21', location: 'Distler Hall', category: 'arts', attendees: 45 },
      { title: 'Career Fair', date: '2026-02-25', location: 'Gantcher Center', category: 'academic', attendees: 200 },
      { title: 'Tufts Dance Collective', date: '2026-02-28', location: 'Balch Arena', category: 'arts', attendees: 80 },
      { title: 'Mens Basketball vs. Bates', date: '2026-02-22', location: 'Cousens Gym', category: 'sports', attendees: 150 },
      { title: 'Womens Lacrosse vs. Colby', date: '2026-03-01', location: 'Bello Field', category: 'sports', attendees: 60 },
      { title: 'Tufts Democrats Meeting', date: '2026-02-24', location: 'Braker 001', category: 'student_orgs', attendees: 25 },
      { title: 'Robotics Club Showcase', date: '2026-03-05', location: 'SEC Atrium', category: 'student_orgs', attendees: 40 },
    ],
  },
  recs: {
    all: [
      { name: 'Tamper Cafe', rating: 4.8, reviews: 142, category: 'food', distance: '0.2 mi' },
      { name: 'Danish Pastry House', rating: 4.7, reviews: 87, category: 'food', distance: '0.4 mi' },
      { name: 'Tisch 4th Floor', rating: 4.9, reviews: 201, category: 'study', distance: 'On campus' },
      { name: 'Brew on the Hill', rating: 4.5, reviews: 63, category: 'food', distance: '0.1 mi' },
      { name: 'Tower Cafe', rating: 4.3, reviews: 55, category: 'hangout', distance: 'On campus' },
      { name: 'SEC Quiet Room', rating: 4.6, reviews: 98, category: 'study', distance: 'On campus' },
      { name: 'Diesel Cafe', rating: 4.4, reviews: 156, category: 'hangout', distance: '0.5 mi' },
    ],
  },
};

// ── Helpers ──
function getDaysUntil(dateStr) {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getTabIcon(iconName, size, color) {
  const props = { size, color, strokeWidth: 2 };
  switch (iconName) {
    case 'home': return <Home {...props} />;
    case 'clock': return <Clock {...props} />;
    case 'shield': return <Shield {...props} />;
    case 'graduationcap': return <GraduationCap {...props} />;
    case 'calendar': return <Calendar {...props} />;
    case 'star': return <Star {...props} />;
    case 'phone': return <Phone {...props} />;
    case 'heart': return <AlertCircle {...props} />;
    case 'users': return <Users {...props} />;
    default: return <Home {...props} />;
  }
}

// ═══════════════════════════════════════════════════════════
// TAB CONTENT COMPONENTS
// ═══════════════════════════════════════════════════════════

function HomeFeedContent({ colors, styles: s }) {
  const modules = [
    { id: 'building_hours', title: 'Building Hours', icon: 'clock', color: '#F59E0B', value: '6 open now' },
    { id: 'emergency', title: 'Emergency', icon: 'shield', color: '#EF4444', value: 'Quick access' },
    { id: 'academic_cal', title: 'Academic Calendar', icon: 'graduationcap', color: '#3579C6', value: 'Spring Break in 23d' },
    { id: 'events', title: 'Campus Events', icon: 'calendar', color: '#6AADE4', value: '3 this week' },
    { id: 'free_food', title: 'Free Food', icon: 'pizza', color: '#22C55E', value: '1 active' },
    { id: 'recs', title: 'Student Recs', icon: 'star', color: '#EAB308', value: '7 places' },
  ];

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Your Campus Dashboard</Text>
      <Text style={s.tabPageSubtitle}>Everything you need, one swipe away</Text>

      {modules.map((mod) => (
        <View key={mod.id} style={s.homeFeedCard}>
          <View style={[s.homeFeedIconWrap, { backgroundColor: mod.color + '18' }]}>
            {getTabIcon(mod.icon, 22, mod.color)}
          </View>
          <View style={s.homeFeedInfo}>
            <Text style={s.homeFeedTitle}>{mod.title}</Text>
            <Text style={s.homeFeedValue}>{mod.value}</Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
      ))}

      <TouchableOpacity
        style={s.browseLink}
        onPress={() => Linking.openURL('https://students.tufts.edu')}
        activeOpacity={0.7}
      >
        <ExternalLink size={14} color={colors.accent} />
        <Text style={s.browseLinkText}>Browse all Tufts resources</Text>
        <ChevronRight size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

function HoursContent({ data, activeChip, styles: s }) {
  const filtered = activeChip === 'all'
    ? data
    : data.filter((item) => item.category === activeChip);

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Building Hours</Text>
      <Text style={s.tabPageSubtitle}>
        {filtered.filter((b) => b.status === 'open').length} of {filtered.length} open right now
      </Text>

      {filtered.map((item, i) => (
        <View key={i} style={s.hoursCard}>
          <View style={s.hoursLeft}>
            <View style={[s.statusIndicator, { backgroundColor: item.status === 'open' ? '#22C55E' : '#EF4444' }]} />
            <View style={s.hoursInfo}>
              <Text style={s.hoursName}>{item.name}</Text>
              <Text style={s.hoursTime}>{item.hours}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, {
            backgroundColor: item.status === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          }]}>
            <Text style={[s.statusBadgeText, {
              color: item.status === 'open' ? '#22C55E' : '#EF4444',
            }]}>{item.status === 'open' ? 'Open' : 'Closed'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function EmergencyContent({ data, activeChip, colors, styles: s }) {
  const filtered = activeChip === 'all'
    ? data
    : data.filter((item) => item.type === activeChip);

  const priorityItems = filtered.filter((item) => item.priority);
  const otherItems = filtered.filter((item) => !item.priority);

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Emergency Contacts</Text>
      <Text style={s.tabPageSubtitle}>Tap to call immediately</Text>

      {priorityItems.length > 0 && (
        <View style={s.emergencyPrioritySection}>
          {priorityItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={s.emergencyPriorityCard}
              onPress={() => Linking.openURL(`tel:${item.phone.replace(/[^\d]/g, '')}`)}
              activeOpacity={0.7}
            >
              <View style={s.emergencyPriorityIcon}>
                <PhoneCall size={24} color="#FFF" strokeWidth={2.5} />
              </View>
              <Text style={s.emergencyPriorityName}>{item.name}</Text>
              <Text style={s.emergencyPriorityPhone}>{item.phone}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {otherItems.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={s.emergencyCard}
          onPress={() => Linking.openURL(`tel:${item.phone.replace(/[^\d]/g, '')}`)}
          activeOpacity={0.7}
        >
          <View style={[s.emergencyIconWrap, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
            <Phone size={18} color="#EF4444" />
          </View>
          <View style={s.emergencyInfo}>
            <Text style={s.emergencyName}>{item.name}</Text>
            <Text style={s.emergencyPhone}>{item.phone}</Text>
          </View>
          <PhoneCall size={18} color={colors.accent} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CalendarContent({ data, activeChip, styles: s }) {
  const filtered = activeChip === 'all'
    ? data
    : data.filter((item) => item.type === activeChip);

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Academic Calendar</Text>
      <Text style={s.tabPageSubtitle}>Upcoming dates and deadlines</Text>

      {filtered.map((item, i) => {
        const days = getDaysUntil(item.date);
        const isPast = days < 0;
        const isToday = days === 0;
        const isSoon = days > 0 && days <= 7;

        return (
          <View key={i} style={[s.calendarCard, isPast && { opacity: 0.5 }]}>
            <View style={s.calendarDateBlock}>
              <Text style={s.calendarMonth}>
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
              <Text style={s.calendarDay}>
                {new Date(item.date).getDate()}
              </Text>
            </View>
            <View style={s.calendarInfo}>
              <Text style={s.calendarName}>{item.name}</Text>
              {item.endDate && (
                <Text style={s.calendarRange}>
                  through {new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={[s.countdownBadge, {
              backgroundColor: isPast ? 'rgba(100,100,100,0.12)' : isToday ? 'rgba(34,197,94,0.15)' : isSoon ? 'rgba(245,158,11,0.15)' : 'rgba(53,121,198,0.12)',
            }]}>
              <Text style={[s.countdownBadgeText, {
                color: isPast ? '#888' : isToday ? '#22C55E' : isSoon ? '#F59E0B' : '#3579C6',
              }]}>
                {isPast ? 'Past' : isToday ? 'Today' : `${days}d`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EventsContent({ data, activeChip, colors, styles: s }) {
  const filtered = activeChip === 'all'
    ? data
    : data.filter((item) => item.category === activeChip);

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Campus Events</Text>
      <Text style={s.tabPageSubtitle}>{filtered.length} upcoming events</Text>

      {filtered.map((item, i) => {
        return (
          <View key={i} style={s.eventCard}>
            <View style={s.eventDateStrip}>
              <Text style={s.eventDateStripMonth}>
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
              <Text style={s.eventDateStripDay}>{new Date(item.date).getDate()}</Text>
            </View>
            <View style={s.eventInfo}>
              <Text style={s.eventTitle}>{item.title}</Text>
              <View style={s.eventMeta}>
                <MapPin size={11} color={colors.textTertiary} />
                <Text style={s.eventMetaText}>{item.location}</Text>
              </View>
              <View style={s.eventMeta}>
                <Users size={11} color={colors.textTertiary} />
                <Text style={s.eventMetaText}>{item.attendees} going</Text>
              </View>
            </View>
            <TouchableOpacity style={s.eventRsvpBtn} activeOpacity={0.7}>
              <Text style={s.eventRsvpText}>RSVP</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function RecsContent({ data, activeChip, colors, styles: s }) {
  const filtered = activeChip === 'all'
    ? data
    : data.filter((item) => item.category === activeChip);

  return (
    <View style={s.tabPage}>
      <Text style={s.tabPageTitle}>Student Recommendations</Text>
      <Text style={s.tabPageSubtitle}>Top-rated spots by Tufts students</Text>

      {filtered.map((item, i) => (
        <View key={i} style={s.recCard}>
          <View style={s.recRank}>
            <Text style={s.recRankText}>#{i + 1}</Text>
          </View>
          <View style={s.recInfo}>
            <Text style={s.recName}>{item.name}</Text>
            <View style={s.recMeta}>
              <Star size={12} color="#EAB308" fill="#EAB308" />
              <Text style={s.recRating}>{item.rating}</Text>
              <Text style={s.recReviews}>({item.reviews})</Text>
              {item.distance && (
                <>
                  <View style={s.recDot} />
                  <MapPin size={11} color={colors.textTertiary} />
                  <Text style={s.recDistance}>{item.distance}</Text>
                </>
              )}
            </View>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════

export default function CustomizationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // State
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [categoryChips, setCategoryChips] = useState({});
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [tabOrder, setTabOrder] = useState(DEFAULT_TABS);

  // Refs
  const scrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  const tabScrollRef = useRef(null);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  // Load saved tab order
  useEffect(() => {
    AsyncStorage.getItem(TAB_ORDER_KEY).then((saved) => {
      if (saved) {
        try {
          const order = JSON.parse(saved);
          const reordered = order
            .map((id) => DEFAULT_TABS.find((t) => t.id === id))
            .filter(Boolean);
          if (reordered.length === DEFAULT_TABS.length) {
            setTabOrder(reordered);
          }
        } catch {}
      }
    });
  }, []);

  // Get active category for current tab
  const getActiveChip = useCallback((tabId) => {
    return categoryChips[tabId] || 'all';
  }, [categoryChips]);

  const setActiveChip = useCallback((tabId, chipId) => {
    setCategoryChips((prev) => ({ ...prev, [tabId]: chipId }));
  }, []);

  // Scroll to tab
  const scrollToTab = useCallback((index) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveTabIndex(index);
  }, []);

  // Handle scroll end (snap)
  const handleScrollEnd = useCallback((e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeTabIndex && index >= 0 && index < tabOrder.length) {
      setActiveTabIndex(index);
    }
  }, [activeTabIndex, tabOrder.length]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
    setIsOnline(true);
  }, []);

  // Tab indicator interpolation
  const tabIndicatorLeft = scrollX.interpolate({
    inputRange: tabOrder.map((_, i) => i * SCREEN_WIDTH),
    outputRange: tabOrder.map((_, i) => i * (SCREEN_WIDTH / tabOrder.length)),
    extrapolate: 'clamp',
  });

  // Move tab (in customize overlay)
  const moveTab = useCallback((fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= tabOrder.length) return;
    setTabOrder((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next.map((t) => t.id))).catch(() => {});
      return next;
    });
  }, [tabOrder.length]);

  // Render tab content
  const renderTabContent = useCallback((tab) => {
    const chip = getActiveChip(tab.id);

    switch (tab.id) {
      case 'home':
        return <HomeFeedContent colors={colors} styles={styles} />;
      case 'hours':
        return <HoursContent data={MOCK_DATA.hours.all} activeChip={chip} styles={styles} />;
      case 'emergency':
        return <EmergencyContent data={MOCK_DATA.emergency.all} activeChip={chip} colors={colors} styles={styles} />;
      case 'calendar':
        return <CalendarContent data={MOCK_DATA.calendar.all} activeChip={chip} styles={styles} />;
      case 'events':
        return <EventsContent data={MOCK_DATA.events.all} activeChip={chip} colors={colors} styles={styles} />;
      case 'recs':
        return <RecsContent data={MOCK_DATA.recs.all} activeChip={chip} colors={colors} styles={styles} />;
      default:
        return null;
    }
  }, [getActiveChip, colors, styles]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: headerFade }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Explore</Text>
        </View>
        <TouchableOpacity
          style={styles.customizeBtn}
          onPress={() => setShowCustomize(true)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={18} color={colors.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Primary Tab Bar (Instagram-style) ── */}
      <Animated.View style={[styles.tabBar, { opacity: contentFade }]}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {tabOrder.map((tab, index) => {
            const isActive = activeTabIndex === index;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabItem}
                onPress={() => scrollToTab(index)}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconWrap, isActive && { backgroundColor: tab.color + '18' }]}>
                  {getTabIcon(tab.icon, 18, isActive ? tab.color : colors.textMuted)}
                </View>
                <Text style={[styles.tabItemText, isActive && { color: colors.text, fontWeight: '800' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Animated underline */}
        <View style={styles.tabUnderlineTrack}>
          <Animated.View
            style={[
              styles.tabUnderline,
              {
                width: SCREEN_WIDTH / tabOrder.length,
                transform: [{ translateX: tabIndicatorLeft }],
              },
            ]}
          />
        </View>
      </Animated.View>

      {/* ── Category Chips ── */}
      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipBarScroll}
        >
          {(TAB_CATEGORIES[tabOrder[activeTabIndex]?.id] || []).map((chip) => {
            const isActive = getActiveChip(tabOrder[activeTabIndex]?.id) === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveChip(tabOrder[activeTabIndex]?.id, chip.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Swipeable Tab Content ── */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={handleScrollEnd}
        style={[styles.pagerContainer, { opacity: contentFade }]}
      >
        {tabOrder.map((tab) => (
          <ScrollView
            key={tab.id}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }
          >
            {renderTabContent(tab)}
          </ScrollView>
        ))}
      </Animated.ScrollView>

      {/* ── Offline indicator ── */}
      {!isOnline && (
        <View style={[styles.offlineBar, { bottom: insets.bottom + 80 }]}>
          <WifiOff size={13} color="#F59E0B" />
          <Text style={styles.offlineText}>Showing cached data</Text>
        </View>
      )}

      {/* ── Customization Overlay ── */}
      <Modal
        visible={showCustomize}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomize(false)}
      >
        <View style={styles.overlayBackdrop}>
          <View style={[styles.overlaySheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.overlayHandle} />

            <View style={styles.overlayHeader}>
              <View>
                <Text style={styles.overlayTitle}>Customize Tabs</Text>
                <Text style={styles.overlaySubtitle}>Drag to reorder your tabs</Text>
              </View>
              <TouchableOpacity
                style={styles.overlayClose}
                onPress={() => setShowCustomize(false)}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.overlayContent}
            >
              {tabOrder.map((tab, index) => (
                <View key={tab.id} style={styles.overlayItem}>
                  <View style={[styles.overlayItemIcon, { backgroundColor: tab.color + '18' }]}>
                    {getTabIcon(tab.icon, 20, tab.color)}
                  </View>
                  <Text style={styles.overlayItemLabel}>{tab.label}</Text>
                  <View style={styles.overlayItemActions}>
                    <TouchableOpacity
                      style={[styles.overlayArrow, index === 0 && { opacity: 0.3 }]}
                      onPress={() => moveTab(index, -1)}
                      disabled={index === 0}
                    >
                      <Text style={styles.overlayArrowText}>Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayArrow, index === tabOrder.length - 1 && { opacity: 0.3 }]}
                      onPress={() => moveTab(index, 1)}
                      disabled={index === tabOrder.length - 1}
                    >
                      <Text style={styles.overlayArrowText}>Down</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.overlayDone}
              onPress={() => setShowCustomize(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.overlayDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav navigation={navigation} activeTab="" />
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.headerBg,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  customizeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // ── Tab Bar ──
  tabBar: {
    backgroundColor: colors.headerBg,
    paddingTop: 4,
  },
  tabBarScroll: {
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    minWidth: SCREEN_WIDTH / 6,
  },
  tabIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabUnderlineTrack: {
    height: 3,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  tabUnderline: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    position: 'absolute',
    bottom: 0,
  },

  // ── Chip Bar ──
  chipBar: {
    backgroundColor: colors.headerBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    paddingBottom: 10,
  },
  chipBarScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  chipTextActive: {
    color: '#FFF',
  },

  // ── Pager ──
  pagerContainer: {
    flex: 1,
  },

  // ── Tab Page (shared) ──
  tabPage: {
    paddingHorizontal: 16,
    paddingTop: 16,
    width: SCREEN_WIDTH,
    gap: 10,
  },
  tabPageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  tabPageSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 6,
  },

  // ── Home Feed Cards ──
  homeFeedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  homeFeedIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFeedInfo: { flex: 1, gap: 2 },
  homeFeedTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  homeFeedValue: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },

  browseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  browseLinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },

  // ── Hours ──
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  hoursLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusIndicator: { width: 10, height: 10, borderRadius: 5 },
  hoursInfo: { flex: 1, gap: 2 },
  hoursName: { fontSize: 15, fontWeight: '700', color: colors.text },
  hoursTime: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  // ── Emergency ──
  emergencyPrioritySection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  emergencyPriorityCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emergencyPriorityIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyPriorityName: { fontSize: 13, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  emergencyPriorityPhone: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  emergencyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyInfo: { flex: 1, gap: 2 },
  emergencyName: { fontSize: 14, fontWeight: '700', color: colors.text },
  emergencyPhone: { fontSize: 13, fontWeight: '600', color: colors.accent },

  // ── Calendar ──
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  calendarDateBlock: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(53,121,198,0.12)' : 'rgba(53,121,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonth: { fontSize: 9, fontWeight: '900', color: '#3579C6', letterSpacing: 0.5 },
  calendarDay: { fontSize: 20, fontWeight: '900', color: '#3579C6', marginTop: -2 },
  calendarInfo: { flex: 1, gap: 2 },
  calendarName: { fontSize: 15, fontWeight: '700', color: colors.text },
  calendarRange: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  countdownBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  countdownBadgeText: { fontSize: 12, fontWeight: '900' },

  // ── Events ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  eventDateStrip: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(106,173,228,0.12)' : 'rgba(106,173,228,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateStripMonth: { fontSize: 9, fontWeight: '900', color: '#6AADE4', letterSpacing: 0.5 },
  eventDateStripDay: { fontSize: 19, fontWeight: '900', color: '#6AADE4', marginTop: -1 },
  eventInfo: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventMetaText: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  eventRsvpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.success || '#22C55E',
  },
  eventRsvpText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  // ── Recs ──
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  recRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(234,179,8,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recRankText: { fontSize: 13, fontWeight: '900', color: '#EAB308' },
  recInfo: { flex: 1, gap: 3 },
  recName: { fontSize: 15, fontWeight: '700', color: colors.text },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recRating: { fontSize: 12, fontWeight: '800', color: '#EAB308' },
  recReviews: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  recDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
  recDistance: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },

  // ── Offline ──
  offlineBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.20)',
  },
  offlineText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },

  // ── Customize Overlay ──
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  overlaySheet: {
    backgroundColor: isDark ? '#0E1C30' : '#F0F7FD',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '75%',
  },
  overlayHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: 12,
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  overlayTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  overlaySubtitle: { fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginTop: 2 },
  overlayClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  overlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  overlayItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayItemLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  overlayItemActions: { flexDirection: 'row', gap: 6 },
  overlayArrow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  overlayArrowText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  overlayDone: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
  },
  overlayDoneText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
