import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Utensils,
  Coffee,
  ShoppingBag,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { diningService } from '../services/dining.service';
import { DINING_LOCATIONS, DINING_CATEGORIES, TYPE_LABELS } from '../data/diningLocations';
import SmartIcon from '../components/SmartIcon';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_W } = Dimensions.get('window');

const MEAL_CONFIG = {
  breakfast: { label: 'Breakfast', emoji: '\u{1F373}', gradient: ['#F59E0B', '#D97706'] },
  lunch: { label: 'Lunch', emoji: '\u{1F96A}', gradient: ['#22C55E', '#16A34A'] },
  dinner: { label: 'Dinner', emoji: '\u{1F35D}', gradient: ['#8B5CF6', '#7C3AED'] },
  'late-night': { label: 'Late Night', emoji: '\u{1F319}', gradient: ['#6366F1', '#4F46E5'] },
};

const TYPE_ICON = {
  dining_hall: Utensils,
  cafe: Coffee,
  grab_and_go: ShoppingBag,
};

const LOCATION_GRADIENTS = [
  ['#FF6B6B', '#EE5A24'],
  ['#6C5CE7', '#A29BFE'],
  ['#00B894', '#00CEC9'],
  ['#FDCB6E', '#F39C12'],
  ['#E17055', '#D63031'],
  ['#0984E3', '#74B9FF'],
  ['#6D214F', '#B33771'],
  ['#1B9CFC', '#25CCF7'],
  ['#55A3A4', '#60A3BC'],
  ['#FC427B', '#EE5A80'],
  ['#2C3A47', '#596275'],
];

export default function DiningScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentMeal = diningService.getCurrentMealPeriod();
  const mealConfig = MEAL_CONFIG[currentMeal] || MEAL_CONFIG.lunch;

  const loadSchools = useCallback(async () => {
    try {
      setError(null);
      const data = await diningService.getSchools();
      setSchools(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
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

  const enrichedLocations = useMemo(() => {
    return DINING_LOCATIONS.map((loc, index) => {
      const apiSchool = schools.find?.((s) => s.slug === loc.slug);
      return {
        ...loc,
        apiSchool: apiSchool || null,
        activeMenuTypes: apiSchool?.active_menu_types || [],
        gradient: LOCATION_GRADIENTS[index % LOCATION_GRADIENTS.length],
      };
    });
  }, [schools]);

  const filteredLocations = useMemo(() => {
    if (activeCategory === 'all') return enrichedLocations;
    return enrichedLocations.filter((loc) => loc.type === activeCategory);
  }, [activeCategory, enrichedLocations]);

  // Separate open vs closed
  const { openLocations, closedLocations } = useMemo(() => {
    const open = [];
    const closed = [];
    filteredLocations.forEach((loc) => {
      const status = loc.apiSchool?.operating_status;
      if (status === 'closed') closed.push(loc);
      else open.push(loc);
    });
    return { openLocations: open, closedLocations: closed };
  }, [filteredLocations]);

  const renderLocationCard = useCallback(({ item: loc, index }) => {
    const opStatus = loc.apiSchool?.operating_status;
    const isClosed = opStatus === 'closed';
    const isClosingSoon = opStatus === 'closing-soon';
    const mealSlugs = loc.activeMenuTypes.map((m) => m.slug);
    const servingMeal = mealSlugs.includes(currentMeal) || mealSlugs.includes('daily');
    const TypeIcon = TYPE_ICON[loc.type] || Utensils;

    const statusColor = isClosed ? '#EF4444' : isClosingSoon ? '#F59E0B' : '#22C55E';
    const statusLabel = isClosed ? 'Closed' : isClosingSoon ? 'Closing Soon' : 'Open Now';

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={[styles.locationCard, isClosed && styles.locationCardClosed]}
          onPress={() => navigation.navigate('DiningMenu', { slug: loc.slug, name: loc.name })}
          activeOpacity={0.7}
        >
          {/* Left accent strip */}
          <LinearGradient
            colors={isClosed ? ['#64748B', '#94A3B8'] : loc.gradient}
            style={styles.cardAccent}
          />

          <View style={styles.cardBody}>
            {/* Top row: icon + info + status */}
            <View style={styles.cardTopRow}>
              <LinearGradient
                colors={isClosed ? ['#64748B20', '#94A3B820'] : [loc.gradient[0] + '20', loc.gradient[1] + '15']}
                style={styles.locationIconWrap}
              >
                <SmartIcon value={loc.image || loc.emoji} size={36} borderRadius={12} />
              </LinearGradient>

              <View style={styles.cardInfoCol}>
                <Text style={[styles.locationName, isClosed && styles.locationNameClosed]}>
                  {loc.name}
                </Text>
                <View style={styles.locationTypeRow}>
                  <TypeIcon size={11} color={isClosed ? colors.textMuted : loc.gradient[0]} />
                  <Text style={[styles.locationTypeText, { color: isClosed ? colors.textMuted : loc.gradient[0] }]}>
                    {TYPE_LABELS[loc.type]}
                  </Text>
                </View>
              </View>

              {/* Status pill */}
              <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            {/* Bottom row: meal info + order CTA */}
            <View style={styles.cardBottomRow}>
              {servingMeal && !isClosed ? (
                <View style={styles.servingInfo}>
                  <Text style={styles.servingEmoji}>{mealConfig.emoji}</Text>
                  <Text style={styles.servingText}>
                    Serving {mealConfig.label}
                  </Text>
                </View>
              ) : isClosed ? (
                <Text style={styles.closedText}>Check back later</Text>
              ) : (
                <Text style={styles.notServingText}>Menu available</Text>
              )}

              <View style={{ flex: 1 }} />

              {loc.hasOrdering && !isClosed ? (
                <View style={[styles.orderCta, { backgroundColor: loc.gradient[0] }]}>
                  <Zap size={11} color="#FFF" />
                  <Text style={styles.orderCtaText}>Order</Text>
                </View>
              ) : !isClosed ? (
                <View style={styles.viewMenuCta}>
                  <Text style={styles.viewMenuText}>View Menu</Text>
                  <ChevronRight size={14} color={colors.textMuted} />
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [styles, colors, currentMeal, mealConfig, navigation, fadeAnim]);

  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const allItems = useMemo(() => {
    const items = [];
    if (openLocations.length > 0) {
      items.push({ type: 'header', title: `Open Now (${openLocations.length})`, key: 'header-open' });
      openLocations.forEach((loc) => items.push({ type: 'location', ...loc, key: loc.slug }));
    }
    if (closedLocations.length > 0) {
      items.push({ type: 'header', title: `Closed (${closedLocations.length})`, key: 'header-closed' });
      closedLocations.forEach((loc) => items.push({ type: 'location', ...loc, key: loc.slug }));
    }
    return items;
  }, [openLocations, closedLocations]);

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'header') return renderSectionHeader(item.title);
    return renderLocationCard({ item, index });
  }, [renderLocationCard]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dining</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Current Meal Hero Card */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={mealConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroLabel}>Currently Serving</Text>
              <Text style={styles.heroMealName}>{mealConfig.label}</Text>
              <View style={styles.heroTimeRow}>
                <Clock size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroTimeText}>
                  {currentMeal === 'breakfast' ? '7:00 AM - 11:00 AM' :
                   currentMeal === 'lunch' ? '11:00 AM - 4:00 PM' :
                   currentMeal === 'dinner' ? '4:00 PM - 9:00 PM' :
                   '9:00 PM - 12:00 AM'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroEmoji}>{mealConfig.emoji}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Category filter buttons */}
      <View style={styles.categoryRow}>
        {DINING_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const CatIcon = cat.id === 'dining_hall' ? Utensils :
                          cat.id === 'cafe' ? Coffee :
                          cat.id === 'grab_and_go' ? ShoppingBag : null;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              {CatIcon && <CatIcon size={13} color={isActive ? '#FFF' : colors.textSecondary} />}
              <Text style={[styles.categoryBtnText, isActive && styles.categoryBtnTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Location list */}
      <FlatList
        data={loading ? [] : allItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>Loading dining locations...</Text>
            </View>
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

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
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
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSpacer: { width: 42 },

  // Hero meal card
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: { flex: 1, gap: 4 },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroMealName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  heroEmoji: {
    fontSize: 52,
    marginLeft: 12,
  },

  // Category filter buttons
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  categoryBtn: {
    flex: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  categoryBtnActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  categoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryBtnTextActive: {
    color: '#FFF',
  },

  // Section headers
  sectionHeaderRow: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // List
  listContent: { paddingHorizontal: 20, paddingTop: 0 },

  // Location card
  locationCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  locationCardClosed: {
    opacity: 0.65,
  },

  // Left accent strip
  cardAccent: {
    width: 5,
  },

  cardBody: {
    flex: 1,
    padding: 14,
    gap: 12,
  },

  // Top row
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationEmoji: { fontSize: 24 },
  cardInfoCol: { flex: 1, gap: 3 },
  locationName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  locationNameClosed: {
    color: colors.textMuted,
  },
  locationTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Bottom row
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 60, // align with text
    gap: 8,
  },
  servingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  servingEmoji: { fontSize: 13 },
  servingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  closedText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  notServingText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // CTAs
  orderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  orderCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  viewMenuCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
