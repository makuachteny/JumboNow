import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  StatusBar,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  MapPin,
  Clock,
  Users,
  TrendingUp,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { eventsService } from '../services/events.service';
import { useTheme } from '../context/ThemeContext';
import { withOpacity } from '../utils/safeColor';
import SmartIcon from '../components/SmartIcon';
import { getEventIcon } from '../config/clubLogos';
import BottomNav from '../components/BottomNav';

const FILTERS_STORAGE_KEY = 'jumbonow_discover_filters';

const DEFAULT_TRENDING = [
  'Spring Fling', 'Free Events', 'Concert', 'Greek Life', 'Hiking', 'Film Festival',
];

const EVENT_CATEGORIES = [
  { id: 'all', label: 'All', icon: '\u{1F300}' },
  { id: 'student_org', label: 'Student Orgs', icon: '\u{1F49C}' },
  { id: 'arts_culture', label: 'Arts & Culture', icon: '\u{1F3AD}' },
  { id: 'sports', label: 'Sports', icon: '\u{1F525}' },
  { id: 'academic', label: 'Academic', icon: '\u{1F4A1}' },
  { id: 'outdoors', label: 'Outdoors', icon: '\u{1F33F}' },
  { id: 'campus_center', label: 'Campus Center', icon: '\u{1F48E}' },
  { id: 'greek_life', label: 'Greek Life', icon: '\u{1F3DB}\uFE0F' },
];

const PRICE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'Any Time' },
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
];

function formatEvent(e) {
  const start = new Date(e.start_time);
  return {
    ...e,
    time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    dateStr: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attendees: e.attendee_count || 0,
    maxCapacity: e.max_capacity || 100,
  };
}

export default function DiscoverScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState([]);
  const [priceFilter, setPriceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [events, setEvents] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempCategories, setTempCategories] = useState([]);
  const [tempPrice, setTempPrice] = useState('all');
  const [tempDate, setTempDate] = useState('all');
  const [trendingSearches, setTrendingSearches] = useState(DEFAULT_TRENDING);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const hasMounted = useRef(false);
  const debounceTimer = useRef(null);
  const fetchIdRef = useRef(0);
  const skipDebounceRef = useRef(false);
  const prevSearchQueryRef = useRef('');
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Load saved filters and trending searches on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters);
          if (parsed.activeCategories) setActiveCategories(parsed.activeCategories);
          else if (parsed.activeCategory && parsed.activeCategory !== 'all') setActiveCategories([parsed.activeCategory]);
          if (parsed.priceFilter) setPriceFilter(parsed.priceFilter);
          if (parsed.dateFilter) setDateFilter(parsed.dateFilter);
        }
      } catch (_) {
        // Ignore errors loading filters, use defaults
      } finally {
        setFiltersLoaded(true);
      }

      try {
        const trending = await eventsService.getTrendingSearches();
        if (trending && trending.length > 0) {
          setTrendingSearches(trending);
        }
      } catch (_) {
        // Fallback to hardcoded defaults already set
      }
    };

    loadInitialData();

    if (!hasMounted.current) {
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      hasMounted.current = true;
    }
  }, [fadeIn]);

  // Save filters to AsyncStorage whenever they change
  useEffect(() => {
    if (!filtersLoaded) return;
    const saveFilters = async () => {
      try {
        await AsyncStorage.setItem(
          FILTERS_STORAGE_KEY,
          JSON.stringify({ activeCategories, priceFilter, dateFilter })
        );
      } catch (_) {
        // Ignore save errors
      }
    };
    saveFilters();
  }, [activeCategories, priceFilter, dateFilter, filtersLoaded]);

  const loadEvents = useCallback(async ({ query = '', searching = false, categories = [], price = 'all', date = 'all', pageNum = 0, append = false } = {}) => {
    const fetchId = ++fetchIdRef.current;

    try {
      setError(null);
      let data;

      if (searching && query.trim().length >= 2) {
        // Search mode: fetch results then apply filters client-side
        data = await eventsService.searchEvents(query, { page: pageNum });

        // Apply active filters client-side
        if (categories.length > 0) {
          data = data.filter(e => categories.includes(e.event_type));
        }
        if (price === 'free') {
          data = data.filter(e => !e.ticket_price || e.ticket_price === 0);
        } else if (price === 'paid') {
          data = data.filter(e => e.ticket_price > 0);
        }
        // Date filtering already handled by base query (future events only)

        // Log the search (fire and forget)
        if (pageNum === 0) {
          eventsService.logSearch(query).catch(() => {});
        }
      } else {
        // Browse mode: use server-side filters
        const filterOpts = { page: pageNum };
        if (categories.length > 0) filterOpts.eventTypes = categories;
        if (price === 'free') filterOpts.isFree = true;
        else if (price === 'paid') filterOpts.isFree = false;
        if (date !== 'all') filterOpts.timeRange = date;

        data = await eventsService.getEventsByFilters(filterOpts);
      }

      // Discard stale response
      if (fetchIdRef.current !== fetchId) return;

      const formatted = data.map(formatEvent);
      if (append) {
        setEvents(prev => [...prev, ...formatted]);
      } else {
        setEvents(formatted);
      }
      setHasMore(formatted.length >= 20);
    } catch (err) {
      if (fetchIdRef.current !== fetchId) return;
      setError(searching ? 'Search failed. Please try again.' : 'Failed to load events. Pull down to retry.');
    } finally {
      if (fetchIdRef.current === fetchId) {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Unified effect: handles both filter changes (immediate) and search typing (debounced)
  useEffect(() => {
    if (!filtersLoaded) return;

    const queryChanged = searchQuery !== prevSearchQueryRef.current;
    prevSearchQueryRef.current = searchQuery;

    setPage(0);
    setHasMore(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const params = {
      query: searchQuery,
      searching: isSearching,
      categories: activeCategories,
      price: priceFilter,
      date: dateFilter,
    };

    // Only debounce when the search text itself changed (user typing), not filter changes
    const shouldDebounce = queryChanged && isSearching && searchQuery.trim().length >= 2 && !skipDebounceRef.current;
    skipDebounceRef.current = false;

    if (shouldDebounce) {
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        loadEvents(params);
      }, 500);
    } else if (isSearching && searchQuery.trim().length > 0 && searchQuery.trim().length < 2) {
      // Query too short to search, don't fetch
      return;
    } else {
      loadEvents(params);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [activeCategories, priceFilter, dateFilter, filtersLoaded, searchQuery, isSearching, loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await loadEvents({ query: searchQuery, searching: isSearching, categories: activeCategories, price: priceFilter, date: dateFilter });
    setRefreshing(false);
  }, [searchQuery, isSearching, activeCategories, priceFilter, dateFilter, loadEvents]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || initialLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    loadEvents({ query: searchQuery, searching: isSearching, categories: activeCategories, price: priceFilter, date: dateFilter, pageNum: nextPage, append: true });
  }, [hasMore, loadingMore, initialLoading, page, searchQuery, isSearching, activeCategories, priceFilter, dateFilter, loadEvents]);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      setPage(0);
      setHasMore(true);
      loadEvents({ query: searchQuery, searching: true, categories: activeCategories, price: priceFilter, date: dateFilter });
    }
  }, [searchQuery, activeCategories, priceFilter, dateFilter, loadEvents]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    setIsSearching(text.length > 0);
    // The unified effect handles fetching (debounced for typing, immediate when cleared)
  }, []);

  const handleTrendingPress = useCallback((term) => {
    skipDebounceRef.current = true;
    setSearchQuery(term);
    setIsSearching(true);
    // The unified effect fires immediately (skipDebounceRef bypasses debounce)
  }, []);

  const retryLoad = useCallback(() => {
    setInitialLoading(true);
    loadEvents({ query: searchQuery, searching: isSearching, categories: activeCategories, price: priceFilter, date: dateFilter });
  }, [searchQuery, isSearching, activeCategories, priceFilter, dateFilter, loadEvents]);

  const activeFilterCount = (activeCategories.length > 0 ? 1 : 0) + (priceFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);

  const activeFilters = [];
  if (activeCategories.length > 0) {
    activeCategories.forEach(id => {
      const cat = EVENT_CATEGORIES.find(c => c.id === id);
      activeFilters.push({
        key: `cat_${id}`,
        label: cat ? `${cat.icon} ${cat.label}` : id,
        onRemove: () => setActiveCategories(prev => prev.filter(c => c !== id)),
      });
    });
  }
  if (priceFilter !== 'all') {
    const pf = PRICE_FILTERS.find(p => p.id === priceFilter);
    activeFilters.push({ key: 'price', label: pf?.label || priceFilter, onRemove: () => setPriceFilter('all') });
  }
  if (dateFilter !== 'all') {
    const df = DATE_FILTERS.find(d => d.id === dateFilter);
    activeFilters.push({ key: 'date', label: df?.label || dateFilter, onRemove: () => setDateFilter('all') });
  }

  const openFilterModal = () => {
    setTempCategories([...activeCategories]);
    setTempPrice(priceFilter);
    setTempDate(dateFilter);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setActiveCategories([...tempCategories]);
    setPriceFilter(tempPrice);
    setDateFilter(tempDate);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setTempCategories([]);
    setTempPrice('all');
    setTempDate('all');
  };

  const renderEventCard = useCallback(({ item: event }) => {
    const isFree = event.ticket_price === 0 || event.ticket_price === null;
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
        activeOpacity={0.92}
        accessibilityLabel={`Event: ${event.title}, at ${event.location}, on ${event.dateStr} at ${event.time}`}
        accessibilityRole="button"
        accessibilityHint="Double tap to view event details"
      >
        <View style={styles.eventCardTop}>
          <View style={[styles.eventIconContainer, { backgroundColor: withOpacity(event.color, '18', colors.accent) }]}>
            <SmartIcon value={getEventIcon(event)} size={28} borderRadius={10} />
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            <View style={styles.eventMetaItem}>
              <MapPin size={13} color={colors.textTertiary} />
              <Text style={styles.eventMetaText} numberOfLines={1}>{event.location}</Text>
            </View>
          </View>
        </View>
        <View style={styles.eventCardBottom}>
          <View style={styles.eventTagsRow}>
            {isFree ? (
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>Free</Text>
              </View>
            ) : (
              <View style={styles.priceTag}>
                <Text style={styles.priceTagText}>${event.ticket_price}</Text>
              </View>
            )}
            {(event.tags || []).slice(0, 1).map((tag) => (
              <View key={tag} style={styles.eventTag}>
                <Text style={styles.eventTagText}>{tag}</Text>
              </View>
            ))}
            <View style={styles.eventMetaItem}>
              <Clock size={12} color={colors.textTertiary} />
              <Text style={styles.eventMetaText}>{event.dateStr} {event.time}</Text>
            </View>
          </View>
          <View style={styles.attendeesBadge}>
            <Users size={12} color={colors.accent} />
            <Text style={styles.attendeesText}>
              {event.attendees}/{event.maxCapacity}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, colors, navigation]);

  const keyExtractor = useCallback((item) => item.id, []);

  const ListHeaderComponent = useMemo(() => (
    <Animated.View style={{ opacity: fadeIn }}>
      {/* Trending Searches */}
      {!isSearching && searchQuery.length === 0 && (
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <TrendingUp size={16} color={colors.accent} accessibilityElementsHidden />
            <Text style={styles.trendingTitle}>Trending Now</Text>
          </View>
          <View style={styles.trendingTags}>
            {trendingSearches.map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.trendingTag}
                onPress={() => handleTrendingPress(term)}
                accessibilityLabel={`Trending search: ${term}`}
                accessibilityRole="button"
                accessibilityHint="Double tap to search for this term"
              >
                <Text style={styles.trendingTagText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Section Header */}
      {!initialLoading && !error && events.length > 0 && (
        <View style={styles.eventSectionHeader}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? 'Search Results' : 'All Events'}
            </Text>
            <Text style={styles.sectionCount}>{events.length}{hasMore ? '+' : ''}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  ), [fadeIn, isSearching, searchQuery, trendingSearches, styles, colors, initialLoading, error, events.length, hasMore, handleTrendingPress]);

  const ListEmptyComponent = useMemo(() => {
    if (initialLoading) {
      return (
        <ActivityIndicator
          color={colors.accent}
          style={{ marginTop: 40 }}
          accessibilityLabel="Loading events"
        />
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Search size={40} color={colors.accentMuted} accessibilityElementsHidden />
          <Text style={styles.emptyTitle} accessibilityRole="header">Something went wrong</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={retryLoad}
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
        <Search size={40} color={colors.accentMuted} accessibilityElementsHidden />
        <Text style={styles.emptyTitle} accessibilityRole="header">No events found</Text>
        <Text style={styles.emptySubtext}>Try a different search or filter</Text>
      </View>
    );
  }, [initialLoading, error, styles, colors, retryLoad]);

  const ListFooterComponent = useMemo(() => {
    if (loadingMore) {
      return (
        <ActivityIndicator
          color={colors.accent}
          style={{ paddingVertical: 20 }}
          accessibilityLabel="Loading more events"
        />
      );
    }
    return null;
  }, [loadingMore, colors]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">Discover</Text>
      </View>

      {/* Search Bar + Filter Icon */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.accentMuted} accessibilityElementsHidden />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, organizers, tags..."
            placeholderTextColor={colors.accentMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            accessibilityLabel="Search events"
            accessibilityHint="Type to search for events, organizers, or tags"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.accent, fontSize: 16 }}>{'\u2715'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={openFilterModal}
          accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to open filter options"
        >
          <SlidersHorizontal size={20} color={activeFilterCount > 0 ? '#FFF' : colors.accent} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeFiltersRow}
          accessibilityRole="toolbar"
          accessibilityLabel="Active filters"
        >
          {activeFilters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={styles.activeChip}
              onPress={f.onRemove}
              accessibilityLabel={`Remove ${f.label} filter`}
              accessibilityRole="button"
            >
              <Text style={styles.activeChipText}>{f.label}</Text>
              <X size={14} color={colors.accent} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => { setActiveCategories([]); setPriceFilter('all'); setDateFilter('all'); }}
            accessibilityLabel="Clear all filters"
            accessibilityRole="button"
          >
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <FlatList
        data={(!initialLoading && !error) ? events : []}
        renderItem={renderEventCard}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        keyboardDismissMode="on-drag"
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        accessibilityLabel="Events list"
        accessibilityRole="list"
      />

      <BottomNav navigation={navigation} activeTab="Discover" />

      {/* Filter Modal */}
      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">Filters</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close filters"
                accessibilityRole="button"
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Category */}
            <Text style={styles.filterSectionTitle} accessibilityRole="header">Category</Text>
            <View style={styles.filterChipsWrap}>
              {EVENT_CATEGORIES.map((cat) => {
                const isAll = cat.id === 'all';
                const isSelected = isAll ? tempCategories.length === 0 : tempCategories.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalChip, isSelected && styles.modalChipActive]}
                    onPress={() => {
                      if (isAll) {
                        setTempCategories([]);
                      } else {
                        setTempCategories(prev =>
                          prev.includes(cat.id)
                            ? prev.filter(id => id !== cat.id)
                            : [...prev, cat.id]
                        );
                      }
                    }}
                    accessibilityLabel={`Category: ${cat.label}${isSelected ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                      {cat.icon} {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Price */}
            <Text style={styles.filterSectionTitle} accessibilityRole="header">Price</Text>
            <View style={styles.filterChipsWrap}>
              {PRICE_FILTERS.map((f) => {
                const isSelected = tempPrice === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.modalChip, isSelected && styles.modalChipActive]}
                    onPress={() => {
                      if (f.id === 'all') {
                        setTempPrice('all');
                      } else {
                        setTempPrice(isSelected ? 'all' : f.id);
                      }
                    }}
                    accessibilityLabel={`Price: ${f.label}${isSelected ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date */}
            <Text style={styles.filterSectionTitle} accessibilityRole="header">Date</Text>
            <View style={styles.filterChipsWrap}>
              {DATE_FILTERS.map((f) => {
                const isSelected = tempDate === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.modalChip, isSelected && styles.modalChipActive]}
                    onPress={() => {
                      if (f.id === 'all') {
                        setTempDate('all');
                      } else {
                        setTempDate(isSelected ? 'all' : f.id);
                      }
                    }}
                    accessibilityLabel={`Date: ${f.label}${isSelected ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}
                accessibilityLabel="Reset all filters"
                accessibilityRole="button"
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={applyFilters}
                accessibilityLabel="Apply selected filters"
                accessibilityRole="button"
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  headerTitle: { color: colors.text, fontSize: 31, fontWeight: '800', letterSpacing: -0.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '400' },
  filterButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: colors.buttonPrimary },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  activeFiltersRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  activeChipText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  clearAllText: { color: colors.error, fontSize: 12, fontWeight: '600', paddingHorizontal: 8 },
  listContent: { paddingHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.modalBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.cardBorder },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  filterSectionTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  modalChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1.5, borderColor: colors.glassBorder },
  modalChipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  modalChipText: { color: colors.textTertiary, fontSize: 13, fontWeight: '600' },
  modalChipTextActive: { color: '#FFF' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  resetButton: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  resetButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  applyButton: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.buttonPrimary },
  applyButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  trendingSection: { paddingVertical: 16 },
  trendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trendingTitle: { color: colors.accent, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  trendingTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trendingTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  trendingTagText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  eventSectionHeader: { marginBottom: 12, paddingTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  eventCard: { marginBottom: 12, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  eventCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingBottom: 10 },
  eventIconContainer: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventIcon: { fontSize: 26 },
  eventInfo: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4, lineHeight: 20 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventMetaText: { color: colors.textTertiary, fontSize: 13, fontWeight: '400', flex: 1 },
  eventCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  eventTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  freeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.12)' },
  freeTagText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  priceTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.accentBg },
  priceTagText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  eventTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.surfaceAlt },
  eventTagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  attendeesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  attendeesText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
