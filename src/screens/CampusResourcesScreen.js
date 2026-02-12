import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Settings2,
  ChevronDown,
  ChevronUp,
  Monitor,
  Trophy,
  ShieldAlert,
  GraduationCap,
  Utensils,
  Dumbbell,
  HeartPulse,
  WashingMachine,
  Car,
  BookOpen,
  Cpu,
  Bus,
  MapPin,
  Pizza,
  X,
  Check,
  GripVertical,
  ExternalLink,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_SIZE = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const FAVORITES_KEY = '@jumbonow_campus_favorites';

// All campus resources matching the Tufts portal + JumboNow extras
const ALL_RESOURCES = [
  {
    id: 'apps_software',
    label: 'Apps & Software',
    Icon: Monitor,
    color: '#418FDE',
    url: 'https://access.tufts.edu/software',
  },
  {
    id: 'athletics',
    label: 'Athletics',
    Icon: Trophy,
    color: '#F59E0B',
    url: 'https://gotuftsjumbos.com',
  },
  {
    id: 'be_safe',
    label: 'Be Safe',
    Icon: ShieldAlert,
    color: '#EF4444',
    url: 'https://publicsafety.tufts.edu',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    Icon: GraduationCap,
    color: '#E74C3C',
    url: 'https://canvas.tufts.edu',
  },
  {
    id: 'dining',
    label: 'Dining & Food',
    Icon: Utensils,
    color: '#F59E0B',
    navigate: 'Dining',
  },
  {
    id: 'fitness',
    label: 'Fitness Center',
    Icon: Dumbbell,
    color: '#8B5CF6',
    url: 'https://ase.tufts.edu/campusrec',
  },
  {
    id: 'health',
    label: 'Health & Wellness',
    Icon: HeartPulse,
    color: '#EF4444',
    url: 'https://students.tufts.edu/health-and-wellness',
  },
  {
    id: 'laundry',
    label: 'Laundry',
    Icon: WashingMachine,
    color: '#0EA5E9',
    url: 'https://www.laundryview.com/tufts',
  },
  {
    id: 'parking',
    label: 'Parking',
    Icon: Car,
    color: '#64748B',
    url: 'https://publicsafety.tufts.edu/parking-transportation',
  },
  {
    id: 'study_spaces',
    label: 'Study Spaces',
    Icon: BookOpen,
    color: '#22C55E',
    url: 'https://tischlibrary.tufts.edu',
  },
  {
    id: 'technology',
    label: 'Technology',
    Icon: Cpu,
    color: '#6366F1',
    url: 'https://it.tufts.edu',
  },
  {
    id: 'shuttle',
    label: 'Tufts Shuttle',
    Icon: Bus,
    color: '#059669',
    url: 'https://publicsafety.tufts.edu/transportation',
  },
  // JumboNow app-native resources
  {
    id: 'map',
    label: 'Campus Map',
    Icon: MapPin,
    color: '#0EA5E9',
    navigate: 'Map',
  },
  {
    id: 'free_food',
    label: 'Free Food',
    Icon: Pizza,
    color: '#22C55E',
    navigate: 'FreeFood',
  },
];

const DEFAULT_FAVORITES = ['dining', 'canvas', 'shuttle', 'map'];

export default function CampusResourcesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [favorites, setFavorites] = useState(DEFAULT_FAVORITES);
  const [mainExpanded, setMainExpanded] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  const [tempFavorites, setTempFavorites] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) setFavorites(parsed);
        } catch {}
      }
    });
  }, []);

  const saveFavorites = useCallback(async (newFavs) => {
    setFavorites(newFavs);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
    } catch {}
  }, []);

  const handleTilePress = useCallback((resource) => {
    if (resource.navigate) {
      navigation.navigate(resource.navigate);
    } else if (resource.url) {
      Linking.openURL(resource.url).catch(() => {
        Alert.alert('Error', 'Could not open this resource.');
      });
    }
  }, [navigation]);

  const favoriteResources = useMemo(() => {
    return favorites
      .map((id) => ALL_RESOURCES.find((r) => r.id === id))
      .filter(Boolean);
  }, [favorites]);

  const openCustomize = useCallback(() => {
    setTempFavorites([...favorites]);
    setShowCustomize(true);
  }, [favorites]);

  const toggleTempFavorite = useCallback((id) => {
    setTempFavorites((prev) => {
      if (prev.includes(id)) return prev.filter((f) => f !== id);
      if (prev.length >= 8) {
        Alert.alert('Limit Reached', 'You can have up to 8 favorites.');
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const saveCustomization = useCallback(() => {
    saveFavorites(tempFavorites);
    setShowCustomize(false);
  }, [tempFavorites, saveFavorites]);

  const renderTile = useCallback((resource, size = TILE_SIZE) => {
    const { Icon } = resource;
    const isInApp = !!resource.navigate;
    return (
      <TouchableOpacity
        key={resource.id}
        style={[styles.tile, { width: size, height: size }]}
        onPress={() => handleTilePress(resource)}
        activeOpacity={0.7}
        accessibilityLabel={resource.label}
        accessibilityRole="button"
      >
        <View style={[styles.tileIconWrap, { backgroundColor: resource.color + '15' }]}>
          <Icon size={28} color={resource.color} strokeWidth={1.8} />
        </View>
        <Text style={styles.tileLabel} numberOfLines={2}>{resource.label}</Text>
        {!isInApp && (
          <ExternalLink
            size={10}
            color={colors.textMuted}
            style={styles.externalBadge}
          />
        )}
      </TouchableOpacity>
    );
  }, [styles, colors, handleTilePress]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* My Menu — Favorites */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Menu</Text>
            <TouchableOpacity onPress={openCustomize} style={styles.customizeBtn} accessibilityLabel="Customize favorites" accessibilityRole="button">
              <Settings2 size={14} color={colors.accent} />
              <Text style={styles.customizeBtnText}>Customize</Text>
            </TouchableOpacity>
          </View>

          {favoriteResources.length > 0 ? (
            <View style={styles.grid}>
              {favoriteResources.map((r) => renderTile(r))}
            </View>
          ) : (
            <TouchableOpacity style={styles.emptyFavs} onPress={openCustomize}>
              <Text style={styles.emptyFavsText}>
                Tap Customize to add your favorite resources
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Main Menu */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeaderRow}
            onPress={() => setMainExpanded((v) => !v)}
            activeOpacity={0.7}
            accessibilityLabel={`Main Menu, ${mainExpanded ? 'collapse' : 'expand'}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: mainExpanded }}
          >
            <Text style={styles.sectionTitle}>Main Menu</Text>
            {mainExpanded
              ? <ChevronUp size={20} color={colors.textMuted} />
              : <ChevronDown size={20} color={colors.textMuted} />
            }
          </TouchableOpacity>

          {mainExpanded && (
            <View style={styles.grid}>
              {ALL_RESOURCES.map((r) => renderTile(r))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Customize Modal */}
      <Modal
        visible={showCustomize}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomize(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize My Menu</Text>
              <TouchableOpacity onPress={() => setShowCustomize(false)} accessibilityLabel="Close customize menu" accessibilityRole="button">
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Select up to 8 resources for quick access
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              {ALL_RESOURCES.map((resource) => {
                const { Icon } = resource;
                const isSelected = tempFavorites.includes(resource.id);
                return (
                  <TouchableOpacity
                    key={resource.id}
                    style={[styles.customizeRow, isSelected && styles.customizeRowSelected]}
                    onPress={() => toggleTempFavorite(resource.id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${resource.label}${isSelected ? ', selected' : ''}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={[styles.customizeIcon, { backgroundColor: resource.color + '15' }]}>
                      <Icon size={20} color={resource.color} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.customizeLabel}>{resource.label}</Text>
                    <View style={[
                      styles.customizeCheck,
                      isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}>
                      {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.modalCount}>
                {tempFavorites.length}/8 selected
              </Text>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={saveCustomization}
                accessibilityLabel="Save customization"
                accessibilityRole="button"
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  scrollContent: {
    paddingTop: 8,
  },

  // Section
  section: {
    paddingHorizontal: GRID_PADDING,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },

  // Customize button
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  customizeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  // Tile
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    gap: 8,
    position: 'relative',
  },
  tileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  externalBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Empty favorites
  emptyFavs: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyFavsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: GRID_PADDING,
    marginVertical: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  modalSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 20,
  },
  modalScroll: {
    maxHeight: 400,
  },

  // Customize rows
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 4,
  },
  customizeRowSelected: {
    backgroundColor: colors.accentBg,
  },
  customizeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customizeLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  customizeCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  // Modal footer
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  modalCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modalSaveBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary,
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
