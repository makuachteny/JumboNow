import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Flame,
  Leaf,
  Wheat,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { diningService } from '../services/dining.service';
import { DINING_LOCATIONS, TRANSACT_LINKS } from '../data/diningLocations';
import SmartIcon from '../components/SmartIcon';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MEAL_EMOJI = {
  breakfast: '\u{1F373}',
  lunch: '\u{1F96A}',
  dinner: '\u{1F35D}',
  'late-night': '\u{1F319}',
  daily: '\u{1F4CB}',
  brunch: '\u{1F950}',
};

const MEAL_GRADIENT = {
  breakfast: ['#F59E0B', '#D97706'],
  lunch: ['#22C55E', '#16A34A'],
  dinner: ['#3579C6', '#2B6CB0'],
  'late-night': ['#1E5A9E', '#163D6B'],
  daily: ['#0EA5E9', '#0284C7'],
  brunch: ['#6AADE4', '#418FDE'],
};

// Diet icon helper
const DIET_ICONS = {
  vegetarian: { label: 'V', color: '#22C55E', bg: '#22C55E18' },
  vegan: { label: 'VG', color: '#16A34A', bg: '#16A34A18' },
  'gluten-free': { label: 'GF', color: '#F59E0B', bg: '#F59E0B18' },
  halal: { label: 'H', color: '#0EA5E9', bg: '#0EA5E918' },
  kosher: { label: 'K', color: '#3579C6', bg: '#3579C618' },
};

export default function DiningMenuScreen({ navigation, route }) {
  const { slug, name } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const locationInfo = DINING_LOCATIONS.find((l) => l.slug === slug);

  const currentMealPeriod = diningService.getCurrentMealPeriod();
  const [activeMeal, setActiveMeal] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [nutritionModal, setNutritionModal] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadMenu = useCallback(async () => {
    try {
      setError(null);
      const schools = await diningService.getSchools();
      const school = schools.find((s) => s.slug === slug);
      const menuTypes = school?.active_menu_types || [];

      if (menuTypes.length === 0) {
        setMeals([]);
        return;
      }

      const allMeals = await diningService.getAllMealsForDay(slug, menuTypes);
      setMeals(allMeals);

      if (allMeals.length > 0 && !activeMeal) {
        const currentMatch = allMeals.find((m) => m.key === currentMealPeriod);
        setActiveMeal(currentMatch ? currentMatch.key : allMeals[0].key);
      }

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (err) {
      setError('Could not load menu. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [slug, currentMealPeriod, activeMeal]);

  useEffect(() => {
    loadMenu();
  }, [slug]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    diningService.clearCache();
    setActiveMeal(null);
    await loadMenu();
    setRefreshing(false);
  }, [loadMenu]);

  const toggleExpand = useCallback((itemId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const sections = useMemo(() => {
    const meal = meals.find((m) => m.key === activeMeal);
    return meal?.stations || [];
  }, [meals, activeMeal]);

  const totalItems = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.data.length, 0);
  }, [sections]);

  const mealTabs = useMemo(() => {
    return meals.map((m) => ({
      key: m.key,
      label: diningService.getMealPeriodLabel(m.key),
      emoji: MEAL_EMOJI[m.key] || '\u{1F37D}',
      gradient: MEAL_GRADIENT[m.key] || ['#6AADE4', '#418FDE'],
      hasData: m.stations.length > 0,
      itemCount: m.stations.reduce((acc, s) => acc + s.data.length, 0),
    }));
  }, [meals]);

  const openTransact = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(TRANSACT_LINKS.deepLink);
      if (canOpen) {
        Linking.openURL(TRANSACT_LINKS.deepLink);
      } else {
        Linking.openURL(Platform.OS === 'ios' ? TRANSACT_LINKS.ios : TRANSACT_LINKS.android);
      }
    } catch (_) {
      Linking.openURL(Platform.OS === 'ios' ? TRANSACT_LINKS.ios : TRANSACT_LINKS.android);
    }
  }, []);

  const renderMenuItem = useCallback(({ item }) => {
    const isExpanded = expandedItems.has(item.id);
    const hasNutrition = item.calories !== null || item.protein !== null;
    const hasAllergens = item.allergens?.length > 0;
    const hasDetails = hasNutrition || hasAllergens || item.ingredients;

    // Determine diet badges from icons
    const dietBadges = (item.icons || []).slice(0, 3);

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={[styles.menuCard, isExpanded && styles.menuCardExpanded]}
          onPress={() => hasDetails && toggleExpand(item.id)}
          activeOpacity={hasDetails ? 0.7 : 1}
          accessibilityLabel={`${item.name}${item.calories !== null ? `, ${item.calories} calories` : ''}${hasDetails ? ', tap to expand' : ''}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
        >
          {/* Main row */}
          <View style={styles.menuCardMain}>
            <View style={styles.menuCardInfo}>
              <Text style={styles.menuItemName}>{item.name}</Text>
              <View style={styles.menuBadgeRow}>
                {item.calories !== null && (
                  <View style={styles.calorieBadge}>
                    <Flame size={10} color="#F59E0B" />
                    <Text style={styles.calorieBadgeText}>{item.calories} cal</Text>
                  </View>
                )}
                {dietBadges.map((icon, i) => {
                  const config = DIET_ICONS[icon.slug] || { label: icon.label?.slice(0, 2) || '?', color: '#6AADE4', bg: '#6AADE418' };
                  return (
                    <View key={i} style={[styles.dietPill, { backgroundColor: config.bg }]}>
                      <Text style={[styles.dietPillText, { color: config.color }]}>{config.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            {hasDetails && (
              <View style={styles.expandIcon}>
                {isExpanded
                  ? <ChevronUp size={16} color={colors.textMuted} />
                  : <ChevronDown size={16} color={colors.textMuted} />
                }
              </View>
            )}
          </View>

          {/* Expanded nutrition */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {hasNutrition && (
                <View style={styles.nutritionBar}>
                  {item.calories !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.calories}</Text>
                      <Text style={styles.nutritionChipLabel}>Cal</Text>
                    </View>
                  )}
                  {item.protein !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.protein}g</Text>
                      <Text style={styles.nutritionChipLabel}>Protein</Text>
                    </View>
                  )}
                  {item.carbs !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.carbs}g</Text>
                      <Text style={styles.nutritionChipLabel}>Carbs</Text>
                    </View>
                  )}
                  {item.fat !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.fat}g</Text>
                      <Text style={styles.nutritionChipLabel}>Fat</Text>
                    </View>
                  )}
                  {item.fiber !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.fiber}g</Text>
                      <Text style={styles.nutritionChipLabel}>Fiber</Text>
                    </View>
                  )}
                  {item.sodium !== null && (
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{item.sodium}mg</Text>
                      <Text style={styles.nutritionChipLabel}>Sodium</Text>
                    </View>
                  )}
                </View>
              )}

              {hasAllergens && (
                <View style={styles.allergenSection}>
                  <View style={styles.allergenHeader}>
                    <AlertTriangle size={12} color="#EF4444" />
                    <Text style={styles.allergenTitle}>Allergens</Text>
                  </View>
                  <View style={styles.allergenChipRow}>
                    {item.allergens.map((a, i) => (
                      <View key={i} style={styles.allergenChip}>
                        <Text style={styles.allergenChipText}>
                          {typeof a === 'string' ? a : a.name || a.label || ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {item.ingredients && (
                <View style={styles.ingredientSection}>
                  <Text style={styles.ingredientLabel}>Ingredients</Text>
                  <Text style={styles.ingredientText}>{item.ingredients}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [styles, colors, expandedItems, toggleExpand, fadeAnim]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    </View>
  ), [styles]);

  const activeMealGradient = MEAL_GRADIENT[activeMeal] || ['#6AADE4', '#418FDE'];

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SmartIcon value={locationInfo?.image || locationInfo?.emoji || '\u{1F37D}'} size={32} borderRadius={10} />
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
            {!loading && totalItems > 0 && (
              <Text style={styles.headerSubtitle}>{totalItems} items today</Text>
            )}
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Meal period tabs — horizontal scroll with gradient cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mealTabScrollContent}
      >
        {mealTabs.map((tab) => {
          const isActive = activeMeal === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.mealTabCard, !tab.hasData && styles.mealTabCardEmpty]}
              onPress={() => setActiveMeal(tab.key)}
              activeOpacity={0.7}
              accessibilityLabel={`${tab.label}${tab.hasData ? `, ${tab.itemCount} items` : ', no items'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              {isActive ? (
                <LinearGradient
                  colors={tab.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mealTabGradient}
                >
                  <Text style={styles.mealTabEmojiActive}>{tab.emoji}</Text>
                  <Text style={styles.mealTabLabelActive}>{tab.label}</Text>
                  {tab.hasData && (
                    <Text style={styles.mealTabCountActive}>{tab.itemCount} items</Text>
                  )}
                </LinearGradient>
              ) : (
                <View style={[styles.mealTabInner, { borderColor: tab.hasData ? colors.cardBorder : colors.glassBorder }]}>
                  <Text style={styles.mealTabEmoji}>{tab.emoji}</Text>
                  <Text style={[styles.mealTabLabel, !tab.hasData && styles.mealTabLabelMuted]}>
                    {tab.label}
                  </Text>
                  {tab.hasData && (
                    <Text style={styles.mealTabCount}>{tab.itemCount}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Menu content */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMenuItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[styles.listContent, {
          paddingBottom: insets.bottom + (locationInfo?.hasOrdering ? 140 : 90),
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>Loading today's menu...</Text>
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
              <Text style={styles.emptyTitle}>No menu available</Text>
              <Text style={styles.emptySubtext}>
                {activeMeal
                  ? `No items for ${diningService.getMealPeriodLabel(activeMeal).toLowerCase()} today`
                  : 'No menu data available for today'}
              </Text>
            </View>
          )
        }
      />

      {/* Order on Transact floating button */}
      {locationInfo?.hasOrdering && (
        <View style={[styles.orderBarWrap, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
          <TouchableOpacity style={styles.orderBar} onPress={openTransact} activeOpacity={0.85} accessibilityLabel="Order on Transact" accessibilityRole="button">
            <LinearGradient
              colors={activeMealGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.orderBarGradient}
            >
              <ShoppingCart size={20} color="#FFF" />
              <Text style={styles.orderBarText}>Order on Transact</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

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
    paddingBottom: 14,
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, marginTop: 1 },
  headerSpacer: { width: 42 },

  // Meal tabs — horizontal scroll cards
  mealTabScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  mealTabCard: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 80,
  },
  mealTabCardEmpty: {
    opacity: 0.5,
  },
  mealTabGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  mealTabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    gap: 2,
  },
  mealTabEmoji: { fontSize: 18 },
  mealTabEmojiActive: { fontSize: 18 },
  mealTabLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  mealTabLabelActive: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  mealTabLabelMuted: { color: colors.textMuted },
  mealTabCount: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  mealTabCountActive: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  // List
  listContent: { paddingHorizontal: 20, paddingTop: 0 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.accentBg,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },

  // Menu item card
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuCardExpanded: {
    borderColor: colors.accentBorder,
  },
  menuCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuCardInfo: { flex: 1, gap: 6 },
  menuItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  menuBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calorieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F59E0B15',
  },
  calorieBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  dietPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dietPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  expandIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Expanded nutrition content
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    gap: 14,
  },
  nutritionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nutritionChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    minWidth: 68,
  },
  nutritionChipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  nutritionChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },

  // Allergens
  allergenSection: { gap: 8 },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allergenTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  allergenChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergenChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  allergenChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },

  // Ingredients
  ingredientSection: { gap: 4 },
  ingredientLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ingredientText: {
    fontSize: 12,
    lineHeight: 18,
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

  // Order bar
  orderBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  orderBar: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  orderBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
  },
  orderBarText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
  },
});
