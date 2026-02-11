import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { diningService } from '../services/dining.service';
import { DINING_LOCATIONS, DINING_CATEGORIES, TYPE_LABELS } from '../data/diningLocations';
import BottomNav from '../components/BottomNav';

const MEAL_PERIOD_EMOJI = {
  breakfast: '\u{1F373}',
  lunch: '\u{1F96A}',
  dinner: '\u{1F35D}',
  'late-night': '\u{1F319}',
};

export default function DiningScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const currentMeal = diningService.getCurrentMealPeriod();

  const loadSchools = useCallback(async () => {
    try {
      setError(null);
      const data = await diningService.getSchools();
      setSchools(data);
    } catch (err) {
      setError('Could not load dining locations. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    diningService.clearCache();
    await loadSchools();
    setRefreshing(false);
  }, [loadSchools]);

  // Match API schools with our known locations for display info
  const enrichedLocations = useMemo(() => {
    return DINING_LOCATIONS.map((loc) => {
      const apiSchool = schools.find?.((s) => s.slug === loc.slug);
      return {
        ...loc,
        apiSchool: apiSchool || null,
        activeMenuTypes: apiSchool?.active_menu_types || [],
      };
    });
  }, [schools]);

  const filteredLocations = useMemo(() => {
    if (activeCategory === 'all') return enrichedLocations;
    return enrichedLocations.filter((loc) => loc.type === activeCategory);
  }, [activeCategory, enrichedLocations]);

  const renderLocationCard = useCallback(({ item: loc }) => {
    // Use operating_status from API: "open", "closed", "closing-soon"
    const opStatus = loc.apiSchool?.operating_status;
    const isClosed = opStatus === 'closed';
    const isClosingSoon = opStatus === 'closing-soon';
    const mealSlugs = loc.activeMenuTypes.map((m) => m.slug);
    const servingMeal = mealSlugs.includes(currentMeal) || mealSlugs.includes('daily');

    const statusColor = isClosed ? '#EF4444' : isClosingSoon ? '#F59E0B' : '#22C55E';
    const statusLabel = isClosed ? 'Closed' : isClosingSoon ? 'Closing Soon' : 'Open';

    return (
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => navigation.navigate('DiningMenu', { slug: loc.slug, name: loc.name })}
        activeOpacity={0.85}
      >
        {/* Row 1: Emoji + Name + Status + Chevron */}
        <View style={styles.cardRow1}>
          <View style={styles.emojiWrap}>
            <Text style={styles.emoji}>{loc.emoji}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{loc.name}</Text>
            <View style={styles.cardBadges}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{TYPE_LABELS[loc.type] || loc.type}</Text>
              </View>
              {opStatus && (
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>

        {/* Row 2: Serving info + Ordering distinction */}
        <View style={styles.cardRow2}>
          {servingMeal ? (
            <View style={styles.servingBadge}>
              <Text style={styles.servingEmoji}>{MEAL_PERIOD_EMOJI[currentMeal] || '\u{1F37D}'}</Text>
              <Text style={styles.servingText}>
                Serving {diningService.getMealPeriodLabel(currentMeal)}
              </Text>
            </View>
          ) : (
            <View style={styles.notServingBadge}>
              <Text style={styles.notServingText}>Not currently serving</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {loc.hasOrdering ? (
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>Order Online</Text>
            </View>
          ) : loc.type === 'dining_hall' ? (
            <View style={styles.swipeInBadge}>
              <Text style={styles.swipeInText}>Swipe In</Text>
            </View>
          ) : (
            <View style={styles.walkInBadge}>
              <Text style={styles.walkInText}>Walk In</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [styles, colors, currentMeal, navigation]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{'\u{1F37D}\uFE0F'}</Text>
          <Text style={styles.headerTitle}>Dining</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Current meal indicator */}
      <View style={styles.mealIndicator}>
        <Text style={styles.mealIndicatorEmoji}>{MEAL_PERIOD_EMOJI[currentMeal] || '\u{1F37D}'}</Text>
        <Text style={styles.mealIndicatorText}>
          Currently serving {diningService.getMealPeriodLabel(currentMeal).toLowerCase()}
        </Text>
      </View>

      {/* Category filter buttons */}
      <View style={styles.filterRow}>
        {DINING_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterBtn, isActive && styles.filterBtnActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Location list */}
      <FlatList
        data={loading ? [] : filteredLocations}
        keyExtractor={(item) => item.slug}
        renderItem={renderLocationCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
          ) : error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\u{1F615}'}</Text>
              <Text style={styles.emptyTitle}>Something went wrong</Text>
              <Text style={styles.emptySubtext}>{error}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\u{1F37D}\uFE0F'}</Text>
              <Text style={styles.emptyTitle}>No locations found</Text>
              <Text style={styles.emptySubtext}>Try a different filter</Text>
            </View>
          )
        }
      />

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
  headerSpacer: { width: 40 },

  // Meal indicator
  mealIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  mealIndicatorEmoji: { fontSize: 14 },
  mealIndicatorText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },

  // Filter buttons
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.headerBg,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
  },
  filterBtnActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  filterBtnTextActive: { color: '#FFF' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Location card
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },

  // Row 1: emoji + info + chevron
  cardRow1: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Row 2: serving info + ordering type
  cardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 54, // align with text (42 emoji + 12 gap)
  },
  servingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  servingEmoji: { fontSize: 12 },
  servingText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  notServingBadge: {},
  notServingText: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  orderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  orderBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  swipeInBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  swipeInText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  walkInBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  walkInText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
