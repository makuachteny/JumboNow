import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { diningService } from '../services/dining.service';
import { DINING_LOCATIONS, TRANSACT_LINKS } from '../data/diningLocations';
import BottomNav from '../components/BottomNav';

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

export default function DiningMenuScreen({ navigation, route }) {
  const { slug, name } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const locationInfo = DINING_LOCATIONS.find((l) => l.slug === slug);

  const currentMealPeriod = diningService.getCurrentMealPeriod();
  const [activeMeal, setActiveMeal] = useState(null); // set after loading
  const [meals, setMeals] = useState([]); // array of { key, name, stations }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());

  const loadMenu = useCallback(async () => {
    try {
      setError(null);
      // First get schools to find this location's active_menu_types
      const schools = await diningService.getSchools();
      const school = schools.find((s) => s.slug === slug);
      const menuTypes = school?.active_menu_types || [];

      if (menuTypes.length === 0) {
        setMeals([]);
        return;
      }

      const allMeals = await diningService.getAllMealsForDay(slug, menuTypes);
      setMeals(allMeals);

      // Auto-select best tab: current meal if available, otherwise first with data
      if (allMeals.length > 0 && !activeMeal) {
        const currentMatch = allMeals.find((m) => m.key === currentMealPeriod);
        setActiveMeal(currentMatch ? currentMatch.key : allMeals[0].key);
      }
    } catch (err) {
      setError('Could not load menu. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [slug, currentMealPeriod, activeMeal]);

  useEffect(() => {
    loadMenu();
  }, [slug]); // only reload when slug changes, not on every activeMeal change

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

  // Build tabs from what the API actually has
  const mealTabs = useMemo(() => {
    return meals.map((m) => ({
      key: m.key,
      label: diningService.getMealPeriodLabel(m.key),
      emoji: MEAL_EMOJI[m.key] || '\u{1F37D}',
      hasData: m.stations.length > 0,
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
    const hasDetails = hasNutrition || item.allergens?.length > 0 || item.ingredients;

    return (
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => hasDetails && toggleExpand(item.id)}
        activeOpacity={hasDetails ? 0.7 : 1}
      >
        <View style={styles.menuItemHeader}>
          <View style={styles.menuItemInfo}>
            <Text style={styles.menuItemName}>{item.name}</Text>
            <View style={styles.menuItemBadges}>
              {item.calories !== null && (
                <View style={styles.calBadge}>
                  <Text style={styles.calBadgeText}>{item.calories} cal</Text>
                </View>
              )}
              {item.icons?.map((icon, i) => (
                <View key={i} style={styles.dietBadge}>
                  <Text style={styles.dietBadgeText}>{icon.label}</Text>
                </View>
              ))}
            </View>
          </View>
          {hasDetails && (
            isExpanded
              ? <ChevronUp size={16} color={colors.textMuted} />
              : <ChevronDown size={16} color={colors.textMuted} />
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Nutrition table */}
            {hasNutrition && (
              <View style={styles.nutritionGrid}>
                {item.calories !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.calories}</Text>
                    <Text style={styles.nutritionLabel}>Calories</Text>
                  </View>
                )}
                {item.protein !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.protein}g</Text>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                  </View>
                )}
                {item.carbs !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.carbs}g</Text>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                  </View>
                )}
                {item.fat !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.fat}g</Text>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                  </View>
                )}
                {item.fiber !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.fiber}g</Text>
                    <Text style={styles.nutritionLabel}>Fiber</Text>
                  </View>
                )}
                {item.sodium !== null && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{item.sodium}mg</Text>
                    <Text style={styles.nutritionLabel}>Sodium</Text>
                  </View>
                )}
              </View>
            )}

            {/* Allergens */}
            {item.allergens?.length > 0 && (
              <View style={styles.allergenSection}>
                <Text style={styles.detailLabel}>Allergens</Text>
                <View style={styles.allergenRow}>
                  {item.allergens.map((a, i) => (
                    <View key={i} style={styles.allergenBadge}>
                      <Text style={styles.allergenBadgeText}>
                        {typeof a === 'string' ? a : a.name || a.label || ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Ingredients */}
            {item.ingredients && (
              <View style={styles.ingredientSection}>
                <Text style={styles.detailLabel}>Ingredients</Text>
                <Text style={styles.ingredientText}>{item.ingredients}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [styles, colors, expandedItems, toggleExpand]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length} items</Text>
    </View>
  ), [styles]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{locationInfo?.emoji || '\u{1F37D}'}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Meal period tabs */}
      <View style={styles.mealTabRow}>
        {mealTabs.map((tab) => {
          const isActive = activeMeal === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.mealTab,
                isActive && styles.mealTabActive,
                tab.hasData === false && styles.mealTabEmpty,
              ]}
              onPress={() => setActiveMeal(tab.key)}
            >
              <Text style={styles.mealTabEmoji}>{tab.emoji}</Text>
              <Text style={[
                styles.mealTabText,
                isActive && styles.mealTabTextActive,
                tab.hasData === false && styles.mealTabTextEmpty,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Menu content */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMenuItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[styles.listContent, {
          paddingBottom: insets.bottom + (locationInfo?.hasOrdering ? 130 : 90),
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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

      {/* Order on Transact button */}
      {locationInfo?.hasOrdering && (
        <View style={[styles.orderBarWrap, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
          <TouchableOpacity style={styles.orderBar} onPress={openTransact} activeOpacity={0.85}>
            <ShoppingCart size={18} color="#FFF" />
            <Text style={styles.orderBarText}>Order on Transact</Text>
          </TouchableOpacity>
        </View>
      )}

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

  // Meal tabs
  mealTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  mealTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.headerBg,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
  },
  mealTabActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  mealTabEmpty: {
    opacity: 0.5,
  },
  mealTabEmoji: { fontSize: 14 },
  mealTabText: { fontSize: 12, fontWeight: '700', color: colors.text },
  mealTabTextActive: { color: '#FFF' },
  mealTabTextEmpty: { color: colors.textMuted },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // Menu item card
  menuItem: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuItemHeader: { flexDirection: 'row', alignItems: 'center' },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  menuItemBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  calBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  calBadgeText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  dietBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  dietBadgeText: { fontSize: 10, fontWeight: '700', color: '#22C55E' },

  // Expanded nutrition content
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    gap: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nutritionItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    minWidth: 70,
  },
  nutritionValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  nutritionLabel: { fontSize: 10, fontWeight: '500', color: colors.textMuted, marginTop: 2 },

  // Allergens
  allergenSection: { gap: 6 },
  detailLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  allergenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  allergenBadgeText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },

  // Ingredients
  ingredientSection: { gap: 4 },
  ingredientText: { fontSize: 12, lineHeight: 17, color: colors.textMuted },

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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  orderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  orderBarText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
