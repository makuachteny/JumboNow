import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  ActivityIndicator,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapViewWrapper';
import {
  Search,
  BookOpen,
  UtensilsCrossed,
  GraduationCap,
  Dumbbell,
  Home,
  MapPin,
  X,
  Navigation,
  Footprints,
  Car,
  Bike,
  Bus,
  RefreshCw,
  AlertCircle,
  Info,
  Clock,
  ExternalLink,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import { CAMPUS_LOCATIONS, LOCATION_CATEGORIES } from '../data/campusLocations';
import { DINING_LOCATIONS, TYPE_LABELS } from '../data/diningLocations';
import { diningService } from '../services/dining.service';
import BottomNav from '../components/BottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Detect if a real Google Maps API key is configured (not a placeholder)
const googleMapsKey =
  Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  '';
const hasRealGoogleMapsKey =
  !!googleMapsKey &&
  !googleMapsKey.includes('YOUR_') &&
  googleMapsKey.length > 20;

const TUFTS_REGION = {
  latitude: 42.4068,
  longitude: -71.1190,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

// ─── Campus locations (imported from shared data, with Icons added for MapScreen) ──
const CATEGORY_ICONS = {
  all: MapPin,
  library: BookOpen,
  dining: UtensilsCrossed,
  academic: GraduationCap,
  athletic: Dumbbell,
  residential: Home,
};

// Enrich shared categories with Icons for map UI
const MAP_LOCATION_CATEGORIES = LOCATION_CATEGORIES.map((cat) => ({
  ...cat,
  Icon: CATEGORY_ICONS[cat.id] || MapPin,
}));

const getCategoryColor = (category) => {
  switch (category) {
    case 'library': return '#8B5CF6';
    case 'dining': return '#F59E0B';
    case 'academic': return '#3B82F6';
    case 'athletic': return '#22C55E';
    case 'residential': return '#EC4899';
    default: return '#418FDE';
  }
};

// ─── Traffic / busyness estimation ──────────────────────────────
const TRAFFIC_CATEGORIES = ['library', 'dining', 'athletic'];

const getTrafficLevel = (location) => {
  if (!TRAFFIC_CATEGORIES.includes(location.category)) return null;

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  let level = 10; // baseline

  if (location.category === 'dining') {
    // Hodgdon (grab-and-go) has a different pattern
    const isGrabAndGo = location.name.toLowerCase().includes('hodgdon');
    if (isGrabAndGo) {
      if (hour >= 7.5 && hour < 10) level = 50 + Math.sin((hour - 7.5) / 2.5 * Math.PI) * 30;
      else if (hour >= 11 && hour < 14) level = 70 + Math.sin((hour - 11) / 3 * Math.PI) * 25;
      else if (hour >= 16.5 && hour < 19) level = 55 + Math.sin((hour - 16.5) / 2.5 * Math.PI) * 25;
      else if (hour >= 19 || hour < 7) level = 5;
    } else {
      // Standard dining halls
      if (hour >= 7.5 && hour < 9.5) level = 40 + Math.sin((hour - 7.5) / 2 * Math.PI) * 35;
      else if (hour >= 11.5 && hour < 13.5) level = 65 + Math.sin((hour - 11.5) / 2 * Math.PI) * 30;
      else if (hour >= 17.5 && hour < 19.5) level = 70 + Math.sin((hour - 17.5) / 2 * Math.PI) * 28;
      else if (hour >= 20 || hour < 7) level = 5;
    }
    if (isWeekend) level *= 0.7;
  } else if (location.category === 'library') {
    if (hour >= 8 && hour < 12) level = 20 + (hour - 8) * 10;
    else if (hour >= 12 && hour < 14) level = 55;
    else if (hour >= 14 && hour < 18) level = 60 + Math.sin((hour - 14) / 4 * Math.PI) * 25;
    else if (hour >= 18 && hour < 20) level = 50;
    else if (hour >= 20 && hour < 23) level = 55 + Math.sin((hour - 20) / 3 * Math.PI) * 30;
    else if (hour >= 23 || hour < 8) level = 10;
    if (isWeekend) level *= 0.6;
  } else if (location.category === 'athletic') {
    if (hour >= 6 && hour < 8) level = 50 + Math.sin((hour - 6) / 2 * Math.PI) * 30;
    else if (hour >= 8 && hour < 11) level = 30;
    else if (hour >= 11 && hour < 14) level = 25;
    else if (hour >= 16 && hour < 20) level = 60 + Math.sin((hour - 16) / 4 * Math.PI) * 30;
    else if (hour >= 20 && hour < 22) level = 40;
    else level = 10;
    if (isWeekend) level *= 0.8;
  }

  level = Math.max(0, Math.min(100, Math.round(level)));

  let label, color;
  if (level < 25) { label = 'Quiet'; color = '#22C55E'; }
  else if (level < 50) { label = 'Moderate'; color = '#F59E0B'; }
  else if (level < 75) { label = 'Busy'; color = '#F97316'; }
  else { label = 'Packed'; color = '#EF4444'; }

  return { level, label, color };
};

// ─── Shuttle API ────────────────────────────────────────────────────
const PASSIO_API = 'https://passio3.com/www/mapGetData.php';
const SYSTEM_ID = '6670';

const SHUTTLE_SCHEDULES = {
  'Davis Direct': {
    days: 'Monday - Friday',
    hours: '7:00 AM - 7:00 PM',
    frequency: 'Every :00 and :30',
    route: 'Campus Center (48 Professors Row) \u2194 Davis Square',
    stops: ['Campus Center', 'Davis Square'],
  },
  'Davis All Stops': {
    days: 'Daily',
    hours: 'Mon-Wed: 7PM-11PM, Thu: 7PM-12AM, Fri: 7PM-2AM, Sat-Sun: 10AM-11PM',
    frequency: 'Every :00 and :30',
    route: 'Campus Center >> Carmichael >> Olin >> Davis Square',
    stops: ['Campus Center', 'Carmichael', 'Olin', 'Davis Square'],
  },
  'Beacon Direct': {
    days: 'Monday - Friday',
    hours: '7:00 AM - 7:00 PM',
    frequency: 'Every :00 and :30',
    route: 'Campus Center \u2194 Beacon St',
    stops: ['Campus Center', 'Beacon St'],
  },
  'SMFA': {
    days: 'Monday - Friday',
    hours: '7:00 AM - 7:00 PM',
    frequency: 'Varies',
    route: 'Campus Center \u2194 SMFA (230 Fenway)',
    stops: ['Campus Center', 'SMFA'],
  },
  'SMFA After 7PM': {
    days: 'Monday - Friday',
    hours: '7:00 PM - 11:00 PM',
    frequency: 'Varies',
    route: 'SMFA Connected shuttle stops at SMFA and Beacon St',
    stops: ['Campus Center', 'SMFA', 'Beacon St'],
  },
  'SMFA Weekend': {
    days: 'Saturday - Sunday',
    hours: '10:00 AM - 11:00 PM',
    frequency: 'Varies',
    route: 'SMFA Connected shuttle on weekend schedule',
    stops: ['Campus Center', 'SMFA'],
  },
  'Tufts Shoppers Shuttle': {
    days: 'Saturday',
    hours: '11:00 AM - 5:00 PM',
    frequency: 'Hourly',
    route: 'Campus Center \u2194 Target / Trader Joe\'s',
    stops: ['Campus Center', 'Target Plaza'],
  },
};

async function fetchShuttleRoutes() {
  const res = await fetch(`${PASSIO_API}?getRoutes=1&deviceId=0`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemSelected0: SYSTEM_ID, amount: 1 }),
  });
  return res.json();
}

async function fetchBuses() {
  const res = await fetch(`${PASSIO_API}?getBuses=1&deviceId=0&speed=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ s0: SYSTEM_ID, sA: 1 }),
  });
  return res.json();
}

async function fetchStops() {
  const res = await fetch(`${PASSIO_API}?getStops=2&deviceId=0`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ s0: SYSTEM_ID, sA: 1 }),
  });
  return res.json();
}

// ─── Routing helpers ────────────────────────────────────────────────
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

async function fetchRoute(points, mode = 'driving') {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const route = data.routes[0];
      return {
        coords: decodePolyline(route.geometry),
        totalDistance: route.distance,
        totalDuration: mode === 'walking' ? route.distance / 1.4 : route.duration,
      };
    }
  } catch (e) {
    console.log('Routing error:', e);
  }
  return null;
}

function formatDuration(seconds) {
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════
export default function MapScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Mode toggle: 'campus' or 'shuttle' ──
  const [mode, setMode] = useState('campus');

  // ── Campus state ──
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // ── Shuttle state ──
  const [shuttleRoutes, setShuttleRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [shuttleStops, setShuttleStops] = useState([]);
  const [routeStops, setRouteStops] = useState({});
  const [shuttleLoading, setShuttleLoading] = useState(true);
  const [shuttleError, setShuttleError] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busRoutePath, setBusRoutePath] = useState(null);
  const [fetchingPath, setFetchingPath] = useState(false);
  const [selectedBus, setSelectedBus] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [scheduleDismissed, setScheduleDismissed] = useState(false);

  // ── Shared navigation state ──
  const [navPath, setNavPath] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // ── Immersive mode: hide/show UI chrome on tap ──
  const [uiVisible, setUiVisible] = useState(true);
  const uiAnim = useRef(new Animated.Value(1)).current;

  // ── Directions popup (Google Maps) ──
  const [directionsTarget, setDirectionsTarget] = useState(null);

  // ── Dining detail state ──
  const [diningSchools, setDiningSchools] = useState([]);
  const [selectedDiningLocation, setSelectedDiningLocation] = useState(null);

  const mapRef = useRef(null);
  const busInterval = useRef(null);
  const pathCache = useRef({});

  // Pulsing animation for traffic dots on busy locations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Campus helpers ─────────────────────────────────────────────
  const diningMapLocations = useMemo(() => {
    return DINING_LOCATIONS.filter(d => d.lat && d.lng).map(d => ({
      id: `dining-${d.slug}`,
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      category: 'dining',
      description: d.description || '',
      emoji: d.emoji,
      slug: d.slug,
      image: d.image,
      type: d.type,
    }));
  }, []);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === 'all') return CAMPUS_LOCATIONS;
    if (activeCategory === 'dining') return diningMapLocations;
    return CAMPUS_LOCATIONS.filter((loc) => loc.category === activeCategory);
  }, [activeCategory, diningMapLocations]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const campusResults = CAMPUS_LOCATIONS.filter(
      (loc) =>
        loc.category !== 'dining' &&
        (loc.name.toLowerCase().includes(q) ||
        loc.description.toLowerCase().includes(q) ||
        loc.category.toLowerCase().includes(q))
    );
    const diningResults = diningMapLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        (TYPE_LABELS[loc.type] || '').toLowerCase().includes(q)
    );
    return [...campusResults, ...diningResults];
  }, [searchQuery, diningMapLocations]);

  const displayedLocations = searchQuery.trim() ? searchResults : categoryFiltered;

  const handleMarkerPress = useCallback((location) => {
    setDirectionsTarget({ name: location.name, lat: location.lat, lng: location.lng, emoji: location.emoji, category: location.category });
    setSelectedLocation(location);
    setSearchFocused(false);
    setSearchQuery('');
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 },
      300
    );
  }, []);

  const handleSearchSelect = useCallback(
    (location) => {
      setSearchQuery('');
      setSearchFocused(false);
      Keyboard.dismiss();
      if (location.slug) {
        handleDiningMarkerPress(location);
      } else {
        handleMarkerPress(location);
      }
    },
    [handleMarkerPress]
  );

  const getDiningStatus = useCallback((slug) => {
    if (!diningSchools.length) return null;
    const school = diningSchools.find(s => s.slug === slug);
    if (!school) return null;
    const isOpen = diningService.isOpenNow(school);
    const dayPrefixes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const prefix = dayPrefixes[new Date().getDay()];
    const startStr = school[`${prefix}_start`];
    const endStr = school[`${prefix}_end`];
    const enabled = school[`${prefix}_enabled`];
    let hours = null;
    if (enabled !== false && startStr && endStr) {
      const formatTime = (t) => {
        const [h, m] = t.split(':');
        const hr = parseInt(h, 10);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
        return `${hr12}:${m} ${ampm}`;
      };
      hours = `${formatTime(startStr)} - ${formatTime(endStr)}`;
    }
    return { isOpen, hours, enabled };
  }, [diningSchools]);

  const handleDiningMarkerPress = useCallback((location) => {
    setSelectedDiningLocation(location);
    setSelectedLocation(null);
    setDirectionsTarget(null);
    setSearchFocused(false);
    setSearchQuery('');
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 },
      300
    );
  }, []);

  // ─── Shuttle helpers ────────────────────────────────────────────
  const loadShuttleData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setShuttleLoading(true);
      setShuttleError(null);

      const [routesData, busesData, stopsData] = await Promise.all([
        fetchShuttleRoutes(),
        fetchBuses(),
        fetchStops(),
      ]);

      const activeRoutes = Array.isArray(routesData)
        ? routesData.filter((r) => r.outdated === '0' || !r.serviceTimeShort)
        : [];
      const allRoutes = Array.isArray(routesData) ? routesData : [];
      setShuttleRoutes(activeRoutes.length > 0 ? activeRoutes : allRoutes);

      const busArray = [];
      if (busesData?.buses) {
        Object.values(busesData.buses).forEach((deviceBuses) => {
          deviceBuses.forEach((b) => {
            if (b.latitude && b.longitude && !b.outOfService) busArray.push(b);
          });
        });
      }
      setBuses(busArray);

      const stopMap = {};
      const orderedByRoute = {};
      if (stopsData?.stops) {
        Object.values(stopsData.stops).forEach((s) => {
          if (s.latitude && s.longitude) {
            if (!stopMap[s.stopId]) {
              stopMap[s.stopId] = { ...s, routeIds: [s.routeId], routeNames: [s.routeName] };
            } else {
              if (!stopMap[s.stopId].routeIds.includes(s.routeId)) {
                stopMap[s.stopId].routeIds.push(s.routeId);
                stopMap[s.stopId].routeNames.push(s.routeName);
              }
            }
            if (!orderedByRoute[s.routeId]) orderedByRoute[s.routeId] = [];
            orderedByRoute[s.routeId].push({
              latitude: parseFloat(s.latitude),
              longitude: parseFloat(s.longitude),
              position: parseInt(s.position, 10) || 0,
              name: s.name,
            });
          }
        });
      }
      Object.keys(orderedByRoute).forEach((routeId) => {
        orderedByRoute[routeId].sort((a, b) => a.position - b.position);
        const deduped = [];
        orderedByRoute[routeId].forEach((coord) => {
          const last = deduped[deduped.length - 1];
          if (!last || last.latitude !== coord.latitude || last.longitude !== coord.longitude)
            deduped.push(coord);
        });
        orderedByRoute[routeId] = deduped;
      });
      setRouteStops(orderedByRoute);
      setShuttleStops(Object.values(stopMap));
      setLastUpdated(new Date());
    } catch (err) {
      setShuttleError('Could not load shuttle data.');
    } finally {
      setShuttleLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshBuses = useCallback(async () => {
    try {
      const busesData = await fetchBuses();
      const busArray = [];
      if (busesData?.buses) {
        Object.values(busesData.buses).forEach((deviceBuses) => {
          deviceBuses.forEach((b) => {
            if (b.latitude && b.longitude && !b.outOfService) busArray.push(b);
          });
        });
      }
      setBuses(busArray);
      setLastUpdated(new Date());
    } catch (_) {}
  }, []);

  // Load shuttle data on mount
  useEffect(() => {
    loadShuttleData();
    busInterval.current = setInterval(refreshBuses, 10000);
    return () => {
      if (busInterval.current) clearInterval(busInterval.current);
    };
  }, [loadShuttleData, refreshBuses]);

  // Fetch dining school data (hours, open/closed status)
  useEffect(() => {
    diningService.getSchools().then(data => {
      setDiningSchools(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // Handle focusLocation param from EventDetail navigation — start directions immediately
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const focusLocation = route?.params?.focusLocation;
      if (!focusLocation) return;
      const q = focusLocation.toLowerCase();
      const match = CAMPUS_LOCATIONS.find(
        (loc) => loc.name.toLowerCase() === q || loc.name.toLowerCase().includes(q)
      );
      if (match) {
        setMode('campus');
        cancelNavigation();
        setTimeout(() => {
          startWalkingNav({ latitude: match.lat, longitude: match.lng, name: match.name });
        }, 500);
      }
      // Clear the param so it doesn't re-trigger on back navigation
      navigation.setParams({ focusLocation: undefined, _ts: undefined });
    });
    return unsubscribe;
  }, [navigation, route?.params?.focusLocation, route?.params?._ts, startWalkingNav, cancelNavigation]);

  const handleShuttleRefresh = useCallback(() => {
    setRefreshing(true);
    pathCache.current = {};
    setBusRoutePath(null);
    loadShuttleData(true);
  }, [loadShuttleData]);

  const filteredStops = useMemo(() => {
    if (!selectedRoute) return shuttleStops;
    return shuttleStops.filter((s) => s.routeIds.includes(selectedRoute.myid));
  }, [shuttleStops, selectedRoute]);

  const filteredBuses = useMemo(() => {
    if (!selectedRoute) return buses;
    return buses.filter((b) => b.routeId === selectedRoute.myid);
  }, [buses, selectedRoute]);

  // ETA + next stops info for each bus
  const busDetails = useMemo(() => {
    const map = {};
    buses.forEach((bus) => {
      const busLat = parseFloat(bus.latitude);
      const busLon = parseFloat(bus.longitude);
      const speedMph = parseFloat(bus.speed) || 12;
      const speedMs = speedMph * 0.44704;
      const stopsOnRoute = shuttleStops.filter((s) => s.routeIds?.includes(bus.routeId));
      const sorted = stopsOnRoute
        .map((s) => {
          const d = haversineDistance(busLat, busLon, parseFloat(s.latitude), parseFloat(s.longitude));
          const etaMins = Math.max(1, Math.round((d / speedMs) / 60));
          return { name: s.name, dist: d, eta: etaMins, etaLabel: etaMins < 60 ? `${etaMins} min` : `${Math.floor(etaMins / 60)}h ${etaMins % 60}m` };
        })
        .sort((a, b) => a.dist - b.dist);
      const nearest = sorted[0];
      if (nearest && nearest.dist > 30) {
        map[bus.busId] = { etaLabel: nearest.etaLabel, nextStop: nearest.name, nextStops: sorted.slice(0, 3) };
      }
    });
    return map;
  }, [buses, shuttleStops]);

  // Fetch road-following path when a shuttle route with active buses is selected
  useEffect(() => {
    if (!selectedRoute) {
      setBusRoutePath(null);
      return;
    }
    const routeId = selectedRoute.myid;
    const activeBuses = buses.filter((b) => b.routeId === routeId);
    const orderedStops = routeStops[routeId];

    if (activeBuses.length === 0 || !orderedStops || orderedStops.length < 2) {
      setBusRoutePath(null);
      return;
    }
    if (pathCache.current[routeId]) {
      setBusRoutePath({ coords: pathCache.current[routeId], color: selectedRoute.color || colors.accent });
      return;
    }
    const loadPath = async () => {
      setFetchingPath(true);
      const points = [...orderedStops, { latitude: orderedStops[0].latitude, longitude: orderedStops[0].longitude }];
      const result = await fetchRoute(points, 'driving');
      if (result && result.coords.length > 0) {
        pathCache.current[routeId] = result.coords;
        setBusRoutePath({ coords: result.coords, color: selectedRoute.color || colors.accent });
      }
      setFetchingPath(false);
    };
    loadPath();
  }, [selectedRoute, buses, routeStops, colors.accent]);

  // Auto-fit map to active buses
  useEffect(() => {
    if (!mapRef.current || shuttleLoading || !selectedRoute || mode !== 'shuttle') return;
    const coords = filteredBuses.map((b) => ({
      latitude: parseFloat(b.latitude),
      longitude: parseFloat(b.longitude),
    }));
    if (coords.length === 1) {
      mapRef.current.animateToRegion({ ...coords[0], latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
    } else if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 180, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }
  }, [filteredBuses, selectedRoute, shuttleLoading, mode]);

  // ─── Shared navigation ──────────────────────────────────────────
  const cancelNavigation = useCallback(() => {
    setNavPath(null);
    setNavigating(false);
  }, []);

  const toggleUI = useCallback(() => {
    const next = !uiVisible;
    setUiVisible(next);
    Animated.timing(uiAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [uiVisible, uiAnim]);

  const openDirections = useCallback((travelMode) => {
    if (!directionsTarget) return;
    const { lat, lng } = directionsTarget;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${travelMode}`;
    Linking.openURL(url);
    setDirectionsTarget(null);
  }, [directionsTarget]);

  const startWalkingNav = useCallback(
    async (destination) => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude } = position.coords;
        const result = await fetchRoute([{ latitude, longitude }, destination], 'walking');
        if (result) {
          setNavPath({
            coords: result.coords,
            distance: formatDistance(result.totalDistance),
            duration: formatDuration(result.totalDuration),
            destination: destination.name || 'Destination',
          });
          setNavigating(true);
          setSelectedLocation(null);
          setSelectedStop(null);
          setDirectionsTarget(null);
          if (mapRef.current && result.coords.length > 0) {
            mapRef.current.fitToCoordinates(result.coords, {
              edgePadding: { top: 140, right: 60, bottom: 260, left: 60 },
              animated: true,
            });
          }
        }
      } catch (e) {
        console.log('Directions error:', e);
      }
    },
    []
  );

  const handleStopPress = useCallback(
    (stop) => {
      if (navigating) cancelNavigation();
      setSelectedStop(stop);
      setDirectionsTarget({ name: stop.name, lat: parseFloat(stop.latitude), lng: parseFloat(stop.longitude) });
      mapRef.current?.animateToRegion(
        { latitude: stop.latitude, longitude: stop.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        300
      );
    },
    [navigating, cancelNavigation]
  );

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion(TUFTS_REGION, 400);
    setSelectedLocation(null);
    setSelectedStop(null);
    setDirectionsTarget(null);
    setSelectedDiningLocation(null);
    cancelNavigation();
  }, [cancelNavigation]);

  // ── Mode toggle ──
  const switchMode = useCallback(
    (newMode) => {
      setMode(newMode);
      setSelectedLocation(null);
      setSelectedStop(null);
      setDirectionsTarget(null);
      setSelectedDiningLocation(null);
      setSearchQuery('');
      setSearchFocused(false);
      cancelNavigation();
      setBusRoutePath(null);
      setSelectedRoute(null);
      setSelectedBus(null);
      mapRef.current?.animateToRegion(TUFTS_REGION, 400);
    },
    [cancelNavigation]
  );

  const timeAgo = lastUpdated
    ? `${Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))}s ago`
    : '';

  const renderSearchItem = useCallback(
    ({ item }) => (
      <TouchableOpacity style={styles.searchItem} onPress={() => handleSearchSelect(item)}>
        <View style={[styles.searchItemIcon, { backgroundColor: getCategoryColor(item.category) + '18' }]}>
          {(() => {
            const Icon = CATEGORY_ICONS[item.category] || MapPin;
            return <Icon size={16} color={getCategoryColor(item.category)} />;
          })()}
        </View>
        <View style={styles.searchItemText}>
          <Text style={styles.searchItemName}>{item.name}</Text>
          <Text style={styles.searchItemCategory} numberOfLines={1}>
            {LOCATION_CATEGORIES.find((c) => c.id === item.category)?.label || 'Campus'}
          </Text>
        </View>
        <MapPin size={16} color="#9CA3AF" />
      </TouchableOpacity>
    ),
    [styles, handleSearchSelect]
  );

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {Platform.OS === 'web' ? (
        <View style={styles.map}>
          <iframe
            title="Tufts Campus Map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${TUFTS_REGION.longitude - TUFTS_REGION.longitudeDelta/2},${TUFTS_REGION.latitude - TUFTS_REGION.latitudeDelta/2},${TUFTS_REGION.longitude + TUFTS_REGION.longitudeDelta/2},${TUFTS_REGION.latitude + TUFTS_REGION.latitudeDelta/2}&layer=mapnik`}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
          {/* Web overlay for campus location list */}
          {mode === 'campus' && displayedLocations.length > 0 && (
            <View style={styles.webLocationList}>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {displayedLocations.map((loc) => {
                  const traffic = getTrafficLevel(loc);
                  return (
                    <TouchableOpacity
                      key={`web-loc-${loc.id}`}
                      style={styles.webLocationItem}
                      onPress={() => {
                        setDirectionsTarget({ name: loc.name, lat: loc.lat, lng: loc.lng, emoji: loc.emoji, category: loc.category });
                        setSelectedLocation(loc);
                      }}
                    >
                      <View style={[styles.webLocIcon, { backgroundColor: getCategoryColor(loc.category) + '18' }]}>
                        {(() => {
                          const Icon = CATEGORY_ICONS[loc.category] || MapPin;
                          return <Icon size={18} color={getCategoryColor(loc.category)} />;
                        })()}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.webLocName}>{loc.name}</Text>
                        <Text style={styles.webLocDesc} numberOfLines={1}>{loc.description}</Text>
                      </View>
                      {traffic && (
                        <View style={[styles.webLocTraffic, { backgroundColor: traffic.color + '18' }]}>
                          <Text style={[styles.webLocTrafficText, { color: traffic.color }]}>{traffic.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={hasRealGoogleMapsKey ? PROVIDER_GOOGLE : undefined}
          initialRegion={TUFTS_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterest
          showsBuildings
          showsIndoors
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            if (directionsTarget || selectedDiningLocation) {
              setDirectionsTarget(null);
              setSelectedLocation(null);
              setSelectedStop(null);
              setSelectedDiningLocation(null);
            }
            mapRef.current?.animateToRegion({
              latitude,
              longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 400);
          }}
        >
          {/* Walking navigation path */}
          {navPath && navPath.coords.length >= 2 && (
            <Polyline
              coordinates={navPath.coords}
              strokeColor="#4285F4"
              strokeWidth={6}
              lineJoin="round"
              lineCap="round"
            />
          )}

          {/* Bus route path — only shown when bus is active */}
          {busRoutePath && busRoutePath.coords.length >= 2 && (
            <Polyline
              coordinates={busRoutePath.coords}
              strokeColor={busRoutePath.color}
              strokeWidth={5}
              lineJoin="round"
              lineCap="round"
            />
          )}

          {/* Campus markers — all buildings in campus mode */}
          {mode === 'campus' &&
            displayedLocations.map((loc) => {
              const isDining = !!loc.slug;
              const traffic = !isDining ? getTrafficLevel(loc) : null;
              const isBusy = traffic && traffic.level >= 50;
              return (
                <Marker
                  key={`loc-${loc.id}`}
                  coordinate={{ latitude: loc.lat, longitude: loc.lng }}
                  onPress={() => isDining ? handleDiningMarkerPress(loc) : handleMarkerPress(loc)}
                  anchor={{ x: 0.5, y: traffic ? 0.5 : 1 }}
                >
                  {traffic ? (
                    <View style={styles.trafficDotContainer}>
                      {isBusy && (
                        <Animated.View
                          style={[
                            styles.trafficDotPulse,
                            {
                              backgroundColor: traffic.color,
                              transform: [{ scale: pulseAnim }],
                            },
                          ]}
                        />
                      )}
                      <View style={[styles.trafficDotInner, { backgroundColor: traffic.color }]} />
                      <Text style={[styles.trafficDotLabel, { color: traffic.color }]}>
                        {traffic.label}
                      </Text>
                    </View>
                  ) : (
                    <View>
                      <View style={[styles.marker, { backgroundColor: getCategoryColor(loc.category) }]}>
                        {(() => {
                          const Icon = CATEGORY_ICONS[loc.category] || MapPin;
                          return <Icon size={16} color="#FFF" />;
                        })()}
                      </View>
                      <View style={[styles.markerArrow, { borderTopColor: getCategoryColor(loc.category) }]} />
                    </View>
                  )}
                </Marker>
              );
            })}

          {/* Shuttle stop markers */}
          {mode === 'shuttle' &&
            filteredStops.map((stop) => (
              <Marker
                key={`stop-${stop.stopId}`}
                coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                onPress={() => handleStopPress(stop)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.stopMarker, selectedStop?.stopId === stop.stopId && styles.stopMarkerSelected]}>
                  <View style={[styles.stopDot, { backgroundColor: stop.color || colors.accent }]} />
                </View>
              </Marker>
            ))}

          {/* Bus markers — always visible when buses exist */}
          {buses.map((bus) => {
            const detail = busDetails[bus.busId];
            return (
              <Marker
                key={`bus-${bus.busId}`}
                coordinate={{ latitude: parseFloat(bus.latitude), longitude: parseFloat(bus.longitude) }}
                anchor={{ x: 0.5, y: 0.3 }}
                flat
                onPress={() => setSelectedBus(bus)}
              >
                <View style={styles.busMarkerWrap}>
                  <View style={[styles.busMarker, { backgroundColor: bus.color || colors.accent }]}>
                    <Bus size={16} color="#FFF" />
                  </View>
                  <View style={[styles.busNameBadge, { backgroundColor: bus.color || colors.accent }]}>
                    <Text style={styles.busNameText} numberOfLines={1}>{bus.busName || bus.busId}</Text>
                  </View>
                  {detail && (
                    <View style={styles.busEtaBadge}>
                      <Text style={styles.busEtaText}>{detail.etaLabel}</Text>
                    </View>
                  )}
                </View>
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* ─── Top bar ─── */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 8, opacity: uiAnim }]} pointerEvents={uiVisible ? 'auto' : 'none'}>
        {mode === 'campus' ? (
          <View style={styles.searchInputWrap}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search campus buildings..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchFocused(false);
                  Keyboard.dismiss();
                }}
              >
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.shuttleTitleBar}>
            <View style={styles.shuttleTitleRow}>
              <Bus size={16} color={colors.accent} />
              <Text style={styles.shuttleTitle}>Tufts Shuttles</Text>
            </View>
            {lastUpdated && (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live {timeAgo}</Text>
              </View>
            )}
          </View>
        )}

        {mode === 'shuttle' ? (
          <TouchableOpacity
            style={[styles.actionBtn, refreshing && styles.actionBtnActive]}
            onPress={handleShuttleRefresh}
          >
            <RefreshCw size={18} color={refreshing ? '#FFF' : '#1A1A2E'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={handleRecenter}>
            <Navigation size={18} color="#418FDE" />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ─── Mode toggle pill ─── */}
      <Animated.View style={[styles.modeToggle, { top: insets.top + 64, opacity: uiAnim }]} pointerEvents={uiVisible ? 'auto' : 'none'}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'campus' && styles.modeBtnActive]}
          onPress={() => switchMode('campus')}
        >
          <MapPin size={14} color={mode === 'campus' ? '#FFF' : '#374151'} />
          <Text style={[styles.modeBtnText, mode === 'campus' && styles.modeBtnTextActive]}>Campus</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'shuttle' && styles.modeBtnActive]}
          onPress={() => switchMode('shuttle')}
        >
          <Bus size={14} color={mode === 'shuttle' ? '#FFF' : '#374151'} />
          <Text style={[styles.modeBtnText, mode === 'shuttle' && styles.modeBtnTextActive]}>Shuttles</Text>
          {buses.length > 0 && (
            <View style={styles.busLiveBadge}>
              <Text style={styles.busLiveBadgeText}>{buses.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Campus mode: search results ─── */}
      {mode === 'campus' && searchFocused && searchQuery.trim().length > 0 && (
        <View style={[styles.searchResults, { top: insets.top + 64 }]}>
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchItem}
              keyboardShouldPersistTaps="handled"
              style={styles.searchResultsList}
            />
          ) : (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText}>No results found</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── Campus mode: category pills ─── */}
      {mode === 'campus' && !searchFocused && (
        <Animated.View style={[styles.categoryBar, { top: insets.top + 108, opacity: uiAnim }]} pointerEvents={uiVisible ? 'auto' : 'none'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {MAP_LOCATION_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              const { Icon } = cat;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => {
                    setActiveCategory(cat.id);
                    setSelectedLocation(null);
                    setDirectionsTarget(null);
                    setSelectedDiningLocation(null);
                  }}
                >
                  <Icon size={14} color={isActive ? '#FFF' : '#374151'} strokeWidth={isActive ? 2.5 : 2} />
                  <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {/* ─── Shuttle mode: compact route pills ─── */}
      {mode === 'shuttle' && (
        <Animated.View style={[styles.categoryBar, { top: insets.top + 108, opacity: uiAnim }]} pointerEvents={uiVisible ? 'auto' : 'none'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <TouchableOpacity
              style={[styles.routePillSmall, !selectedRoute && styles.routePillSmallActive]}
              onPress={() => {
                setSelectedRoute(null);
                setSelectedStop(null);
                setSelectedBus(null);
                setBusRoutePath(null);
                cancelNavigation();
              }}
            >
              <Text style={[styles.routePillSmallText, !selectedRoute && styles.routePillSmallTextActive]}>All</Text>
              {buses.length > 0 && (
                <View style={[styles.routePillSmallBadge, { backgroundColor: !selectedRoute ? 'rgba(255,255,255,0.3)' : colors.accent + '20' }]}>
                  <Text style={[styles.routePillSmallBadgeText, { color: !selectedRoute ? '#FFF' : colors.accent }]}>{buses.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            {shuttleRoutes.map((route) => {
              const isActive = selectedRoute?.myid === route.myid;
              const busCount = buses.filter((b) => b.routeId === route.myid).length;
              return (
                <TouchableOpacity
                  key={route.myid}
                  style={[styles.routePillSmall, isActive && { backgroundColor: route.color }, !isActive && busCount === 0 && { opacity: 0.5 }]}
                  onPress={() => {
                    setSelectedRoute(isActive ? null : route);
                    setSelectedStop(null);
                    setSelectedBus(null);
                    setScheduleDismissed(false);
                    if (isActive) {
                      setBusRoutePath(null);
                      cancelNavigation();
                    }
                  }}
                >
                  <View style={[styles.routePillSmallDot, { backgroundColor: isActive ? '#FFF' : route.color }]} />
                  <Text style={[styles.routePillSmallText, isActive && styles.routePillSmallTextActive]} numberOfLines={1}>
                    {route.name}
                  </Text>
                  {busCount > 0 && (
                    <View style={[styles.routePillSmallBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : route.color + '20' }]}>
                      <Text style={[styles.routePillSmallBadgeText, { color: isActive ? '#FFF' : route.color }]}>{busCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {/* ─── Shuttle: alert banner ─── */}
      {mode === 'shuttle' && !alertDismissed && (
        <View style={[styles.alertBanner, { top: insets.top + 148 }]}>
          <AlertCircle size={14} color="#B45309" />
          <Text style={styles.alertBannerText}>University Holiday Schedule may affect service hours</Text>
          <TouchableOpacity onPress={() => setAlertDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color="#B45309" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Shuttle: bus detail popup ─── */}
      {selectedBus && (() => {
        const detail = busDetails[selectedBus.busId];
        const busColor = selectedBus.color || colors.accent;
        const speed = parseFloat(selectedBus.speed) || 0;
        return (
          <View style={[styles.busPopup, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.busPopupHeader}>
              <View style={[styles.busPopupIcon, { backgroundColor: busColor }]}>
                <Bus size={20} color="#FFF" />
              </View>
              <View style={styles.busPopupInfo}>
                <Text style={styles.busPopupTitle}>Bus {selectedBus.busName}</Text>
                <Text style={styles.busPopupRoute} numberOfLines={1}>{selectedBus.route || 'Unknown Route'}</Text>
              </View>
              <TouchableOpacity style={styles.busPopupClose} onPress={() => setSelectedBus(null)}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={styles.busPopupMeta}>
              <View style={styles.busPopupMetaItem}>
                <View style={[styles.liveDotSmall, { backgroundColor: colors.success }]} />
                <Text style={styles.busPopupMetaText}>Live</Text>
              </View>
              {speed > 0 && (
                <View style={styles.busPopupMetaItem}>
                  <Text style={styles.busPopupMetaText}>{speed.toFixed(1)} mph</Text>
                </View>
              )}
              {detail && (
                <View style={styles.busPopupMetaItem}>
                  <Text style={[styles.busPopupMetaText, { color: busColor, fontWeight: '700' }]}>{detail.etaLabel} to next</Text>
                </View>
              )}
            </View>
            {detail && detail.nextStops.length > 0 && (
              <View style={styles.busPopupStops}>
                <Text style={styles.busPopupStopsLabel}>Upcoming stops</Text>
                {detail.nextStops.map((stop, idx) => {
                  const isNext = idx === 0;
                  return (
                    <View key={stop.name} style={styles.busPopupStopRow}>
                      <View style={styles.busPopupStopDotCol}>
                        <View style={[styles.busPopupStopDot, { backgroundColor: isNext ? busColor : '#D1D5DB' }]} />
                        {idx < detail.nextStops.length - 1 && <View style={styles.busPopupStopLine} />}
                      </View>
                      <Text style={[styles.busPopupStopName, isNext && { fontWeight: '700', color: '#1A1A2E' }]} numberOfLines={1}>{stop.name}</Text>
                      <View style={[styles.busPopupStopEta, { backgroundColor: isNext ? busColor + '15' : '#F3F4F6' }]}>
                        <Text style={[styles.busPopupStopEtaText, { color: isNext ? busColor : '#6B7280' }]}>{stop.etaLabel}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })()}

      {/* ─── Fetching path indicator ─── */}
      {fetchingPath && (
        <View style={[styles.fetchingBar, { top: insets.top + 150 }]}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.fetchingText}>Loading route...</Text>
        </View>
      )}

      {/* ─── Walking navigation card ─── */}
      {navigating && navPath && (
        <View style={[styles.navCard, { bottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.navCardHeader}>
            <View style={styles.navCardIconWrap}>
              <Footprints size={20} color="#4285F4" />
            </View>
            <View style={styles.navCardInfo}>
              <Text style={styles.navCardTitle} numberOfLines={1}>
                Walking to {navPath.destination}
              </Text>
              <View style={styles.navCardDetails}>
                <Text style={styles.navCardDuration}>{navPath.duration}</Text>
                <View style={styles.navCardDot} />
                <Text style={styles.navCardDistance}>{navPath.distance}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.navCardClose} onPress={cancelNavigation}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View style={styles.navCardProgress}>
            <View style={[styles.navCardProgressFill, { backgroundColor: '#4285F4' }]} />
          </View>
        </View>
      )}

      {/* ─── Directions popup (Google Maps) ─── */}
      {directionsTarget && !navigating && !selectedDiningLocation && (
        <View style={[styles.directionsCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.dragHandle} />
          <View style={styles.directionsHeader}>
            <View style={styles.directionsInfo}>
              <Text style={styles.directionsTitle}>{directionsTarget.name}</Text>
              <Text style={styles.directionsSubtitle}>Get directions via Google Maps</Text>
            </View>
            <TouchableOpacity
              style={styles.cardClose}
              onPress={() => {
                setDirectionsTarget(null);
                setSelectedLocation(null);
                setSelectedStop(null);
              }}
            >
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View style={styles.directionsModes}>
            <TouchableOpacity style={styles.dirModeBtn} onPress={() => openDirections('walking')}>
              <View style={[styles.dirModeIcon, { backgroundColor: '#4285F415' }]}>
                <Footprints size={22} color="#4285F4" />
              </View>
              <Text style={styles.dirModeLabel}>Walk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirModeBtn} onPress={() => openDirections('transit')}>
              <View style={[styles.dirModeIcon, { backgroundColor: colors.success + '15' }]}>
                <Bus size={22} color={colors.success} />
              </View>
              <Text style={styles.dirModeLabel}>Transit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirModeBtn} onPress={() => openDirections('driving')}>
              <View style={[styles.dirModeIcon, { backgroundColor: '#F59E0B15' }]}>
                <Car size={22} color="#F59E0B" />
              </View>
              <Text style={styles.dirModeLabel}>Drive</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirModeBtn} onPress={() => openDirections('bicycling')}>
              <View style={[styles.dirModeIcon, { backgroundColor: '#EC489915' }]}>
                <Bike size={22} color="#EC4899" />
              </View>
              <Text style={styles.dirModeLabel}>Bike</Text>
            </TouchableOpacity>
          </View>
          {directionsTarget.category === 'dining' && (() => {
            const diningMatch = DINING_LOCATIONS.find((d) => directionsTarget.name.toLowerCase().includes(d.name.toLowerCase()));
            if (!diningMatch) return null;
            return (
              <TouchableOpacity
                style={styles.viewMenuBtn}
                onPress={() => {
                  setDirectionsTarget(null);
                  setSelectedLocation(null);
                  navigation.navigate('DiningMenu', { slug: diningMatch.slug, name: diningMatch.name });
                }}
              >
                <UtensilsCrossed size={16} color="#FFF" />
                <Text style={styles.viewMenuBtnText}>View Menu</Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      )}

      {/* ─── Shuttle: route schedule panel (when a route is selected) ─── */}
      {mode === 'shuttle' && selectedRoute && !navigating && !selectedStop && !scheduleDismissed && (() => {
        const schedule = SHUTTLE_SCHEDULES[selectedRoute.name] || null;
        const activeBusCount = filteredBuses.length;
        const routeColor = selectedRoute.color || colors.accent;
        return (
          <View style={[styles.schedulePanel, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.schedulePanelHeader}>
              <View style={[styles.schedulePanelAccent, { backgroundColor: routeColor }]} />
              <View style={styles.schedulePanelHeaderInfo}>
                <Text style={styles.schedulePanelTitle}>{selectedRoute.name}</Text>
                <View style={styles.schedulePanelBadgeRow}>
                  <View style={[styles.schedulePanelBusCountBadge, { backgroundColor: activeBusCount > 0 ? colors.success + '18' : '#EF444418' }]}>
                    <Bus size={12} color={activeBusCount > 0 ? colors.success : '#EF4444'} />
                    <Text style={[styles.schedulePanelBusCountText, { color: activeBusCount > 0 ? colors.success : '#EF4444' }]}>
                      {activeBusCount} active {activeBusCount === 1 ? 'bus' : 'buses'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.cardClose}
                onPress={() => setScheduleDismissed(true)}
              >
                <X size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {schedule ? (
              <ScrollView style={styles.scheduleContent} showsVerticalScrollIndicator={false}>
                <View style={styles.scheduleRow}>
                  <Info size={14} color="#6B7280" />
                  <View style={styles.scheduleRowContent}>
                    <Text style={styles.scheduleRowLabel}>Service Days</Text>
                    <Text style={styles.scheduleRowValue}>{schedule.days}</Text>
                  </View>
                </View>
                <View style={styles.scheduleRow}>
                  <Clock size={14} color="#6B7280" />
                  <View style={styles.scheduleRowContent}>
                    <Text style={styles.scheduleRowLabel}>Hours</Text>
                    <Text style={styles.scheduleRowValue}>{schedule.hours}</Text>
                  </View>
                </View>
                <View style={styles.scheduleRow}>
                  <RefreshCw size={14} color="#6B7280" />
                  <View style={styles.scheduleRowContent}>
                    <Text style={styles.scheduleRowLabel}>Frequency</Text>
                    <Text style={styles.scheduleRowValue}>{schedule.frequency}</Text>
                  </View>
                </View>
                <View style={styles.scheduleRow}>
                  <Navigation size={14} color="#6B7280" />
                  <View style={styles.scheduleRowContent}>
                    <Text style={styles.scheduleRowLabel}>Route</Text>
                    <Text style={styles.scheduleRowValue}>{schedule.route}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.liveTrackingBtn, { backgroundColor: routeColor }]}
                  onPress={() => Linking.openURL(`https://passio3.com/tufts/routes`)}
                >
                  <ExternalLink size={14} color="#FFF" />
                  <Text style={styles.liveTrackingBtnText}>Live Tracking on Passio GO</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={styles.scheduleNoData}>
                <Info size={16} color="#9CA3AF" />
                <Text style={styles.scheduleNoDataText}>Schedule info not available for this route</Text>
                <TouchableOpacity
                  style={[styles.liveTrackingBtn, { backgroundColor: routeColor, marginTop: 12 }]}
                  onPress={() => Linking.openURL(`https://passio3.com/tufts/routes`)}
                >
                  <ExternalLink size={14} color="#FFF" />
                  <Text style={styles.liveTrackingBtnText}>View on Passio GO</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })()}

      {/* Bus info cards removed — info is now in route pills */}

      {/* ─── Shuttle: no buses message ─── */}
      {mode === 'shuttle' && !shuttleLoading && buses.length === 0 && !shuttleError && !navigating && !selectedStop && (
        <View style={[styles.noBusBar, { bottom: Math.max(insets.bottom, 16) + 70 }]}>
          <Bus size={18} color="#9CA3AF" />
          <Text style={styles.noBusText}>No shuttles currently in service</Text>
        </View>
      )}

      {/* ─── Shuttle error ─── */}
      {shuttleError && (
        <View style={[styles.errorBar, { top: insets.top + 150 }]}>
          <Text style={styles.errorText}>{shuttleError}</Text>
          <TouchableOpacity
            onPress={() => {
              setShuttleError(null);
              loadShuttleData();
            }}
          >
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Dining detail bottom sheet ─── */}
      {selectedDiningLocation && !navigating && (() => {
        const status = getDiningStatus(selectedDiningLocation.slug);
        return (
          <View style={[styles.diningDetailCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.dragHandle} />
            <Image source={{ uri: selectedDiningLocation.image }} style={styles.diningDetailImage} />
            <View style={styles.diningDetailInfo}>
              <View style={styles.diningDetailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diningDetailName}>{selectedDiningLocation.name}</Text>
                  <View style={styles.diningDetailMeta}>
                    <View style={styles.diningTypeBadge}>
                      <UtensilsCrossed size={11} color="#F59E0B" />
                      <Text style={styles.diningTypeText}>{TYPE_LABELS[selectedDiningLocation.type] || selectedDiningLocation.type}</Text>
                    </View>
                    {status && status.isOpen !== null && (
                      <View style={[styles.diningStatusBadge, { backgroundColor: status.isOpen ? colors.success + '15' : '#EF444415' }]}>
                        <View style={[styles.diningStatusDot, { backgroundColor: status.isOpen ? colors.success : '#EF4444' }]} />
                        <Text style={[styles.diningStatusText, { color: status.isOpen ? '#16A34A' : '#DC2626' }]}>
                          {status.isOpen ? 'Open' : 'Closed'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.cardClose}
                  onPress={() => setSelectedDiningLocation(null)}
                >
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {status?.hours && (
                <View style={styles.diningHoursRow}>
                  <Clock size={14} color="#6B7280" />
                  <Text style={styles.diningHoursText}>{status.hours}</Text>
                </View>
              )}
              {selectedDiningLocation.description ? (
                <Text style={styles.diningDetailDesc}>{selectedDiningLocation.description}</Text>
              ) : null}
              <View style={styles.diningDetailButtons}>
                <TouchableOpacity
                  style={styles.diningMenuBtn}
                  onPress={() => {
                    const loc = selectedDiningLocation;
                    setSelectedDiningLocation(null);
                    navigation.navigate('DiningMenu', { slug: loc.slug, name: loc.name });
                  }}
                >
                  <UtensilsCrossed size={16} color="#FFF" />
                  <Text style={styles.diningMenuBtnText}>View Menu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.diningDirBtn}
                  onPress={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedDiningLocation.lat},${selectedDiningLocation.lng}&travelmode=walking`;
                    Linking.openURL(url);
                  }}
                >
                  <Navigation size={16} color="#418FDE" />
                  <Text style={styles.diningDirBtnText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

      <BottomNav navigation={navigation} activeTab="Map" visible={uiVisible && !directionsTarget && !navigating && !selectedDiningLocation} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFB' },
    map: { ...StyleSheet.absoluteFillObject },

    // Top bar
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 8,
    },
    searchInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FFFFFFEE',
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 42,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    searchInput: { flex: 1, fontSize: 15, fontWeight: '400', color: '#1A1A2E' },
    shuttleTitleBar: {
      flex: 1,
      backgroundColor: '#FFFFFFEE',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    shuttleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    shuttleTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    liveText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
    actionBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFFFFFEE',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    actionBtnActive: { backgroundColor: colors.accent },

    // Mode toggle
    modeToggle: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: '#FFFFFFEE',
      borderRadius: 24,
      padding: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    modeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
    },
    modeBtnActive: { backgroundColor: '#418FDE' },
    modeBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    modeBtnTextActive: { color: '#FFF' },
    busLiveBadge: {
      backgroundColor: colors.success,
      borderRadius: 8,
      paddingHorizontal: 5,
      paddingVertical: 1,
      marginLeft: 2,
    },
    busLiveBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

    // Search results
    searchResults: {
      position: 'absolute',
      left: 14,
      right: 14,
      backgroundColor: '#FFFFFFF8',
      borderRadius: 16,
      maxHeight: 300,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    searchResultsList: { paddingVertical: 4 },
    searchItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    searchItemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    searchItemEmoji: { fontSize: 18 },
    searchItemText: { flex: 1 },
    searchItemName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
    searchItemCategory: { fontSize: 12, fontWeight: '400', color: '#6B7280', marginTop: 1 },
    searchEmpty: { paddingVertical: 24, alignItems: 'center' },
    searchEmptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

    // Category & route pills
    categoryBar: { position: 'absolute', left: 0, right: 0 },
    categoryScroll: { paddingHorizontal: 14, gap: 8 },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 24,
      backgroundColor: '#FFFFFFEE',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    categoryPillActive: { backgroundColor: '#418FDE' },
    categoryPillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    categoryPillTextActive: { color: '#FFF' },

    routePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: '#FFFFFFEE',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    routePillActive: { backgroundColor: colors.buttonPrimary },
    // Compact route pills
    routePillSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: '#FFFFFFEE',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    routePillSmallActive: { backgroundColor: colors.buttonPrimary },
    routePillSmallDot: { width: 6, height: 6, borderRadius: 3 },
    routePillSmallText: { fontSize: 11, fontWeight: '600', color: '#374151', maxWidth: 100 },
    routePillSmallTextActive: { color: '#FFF' },
    routePillSmallBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
    routePillSmallBadgeText: { fontSize: 9, fontWeight: '700' },
    routeColorDot: { width: 8, height: 8, borderRadius: 4 },
    routePillText: { fontSize: 13, fontWeight: '600', color: '#374151', maxWidth: 130 },
    routePillTextActive: { color: '#FFF' },
    busCountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 2 },
    busCountText: { fontSize: 10, fontWeight: '700' },

    // Fetching
    fetchingBar: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FFFFFFEE',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    fetchingText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },

    // Campus traffic dot markers
    trafficDotContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    trafficDotPulse: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderRadius: 8,
      opacity: 0.3,
    },
    trafficDotInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: '#FFFFFFCC',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    trafficDotLabel: {
      fontSize: 7,
      fontWeight: '800',
      marginTop: 2,
      textShadowColor: '#FFFFFFAA',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 2,
    },
    marker: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: '#FFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    markerEmoji: { fontSize: 16 },
    markerArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      alignSelf: 'center',
      marginTop: -1,
    },

    // Shuttle markers
    stopMarker: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFFFFFEE',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#E5E7EB',
    },
    stopMarkerSelected: { borderColor: colors.accent, borderWidth: 2.5, transform: [{ scale: 1.2 }] },
    stopDot: { width: 10, height: 10, borderRadius: 5 },
    busMarkerWrap: {
      alignItems: 'center',
    },
    busMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#FFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    busNameBadge: {
      marginTop: 2,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 6,
    },
    busNameText: {
      color: '#FFF',
      fontSize: 8,
      fontWeight: '700',
      maxWidth: 50,
      textAlign: 'center',
    },
    busEtaBadge: {
      marginTop: 1,
      backgroundColor: '#FFFFFFEE',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    busEtaText: {
      color: '#374151',
      fontSize: 8,
      fontWeight: '700',
    },

    // Info card (shared)
    infoCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFFF8',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 10,
    },
    dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 14 },
    infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
    infoCardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    infoCardEmoji: { fontSize: 24 },
    infoCardHeaderText: { flex: 1, gap: 4 },
    infoCardTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
    infoCardCategoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    infoCardCategoryText: { fontSize: 12, fontWeight: '600' },
    trafficRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#F9FAFB',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    trafficLabel: { fontSize: 13, fontWeight: '700', minWidth: 62 },
    trafficBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: '#E5E7EB',
      borderRadius: 3,
      overflow: 'hidden',
    },
    trafficBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    infoCardDesc: { fontSize: 14, lineHeight: 20, color: '#6B7280', marginBottom: 14 },
    cardClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    directionsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#418FDE',
      marginBottom: 8,
    },
    directionsBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

    // Navigation card
    navCard: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: '#FFFFFFFA',
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    navCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    navCardIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4285F414', alignItems: 'center', justifyContent: 'center' },
    navCardInfo: { flex: 1 },
    navCardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
    navCardDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    navCardDuration: { fontSize: 14, fontWeight: '600', color: '#4285F4' },
    navCardDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
    navCardDistance: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
    navCardClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    navCardProgress: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 14, overflow: 'hidden' },
    navCardProgressFill: { width: '100%', height: '100%', borderRadius: 2 },

    // Bus info bar
    busInfoBar: { position: 'absolute', left: 16, right: 16 },
    busInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFFFA',
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    busInfoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    busInfoText: { flex: 1 },
    busInfoRoute: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
    busInfoName: { fontSize: 12, fontWeight: '400', color: '#6B7280', marginTop: 1 },
    busInfoLive: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    busInfoLiveText: { fontSize: 11, fontWeight: '600', color: colors.success },

    // Error & no-bus
    errorBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FEE2E2',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', flex: 1 },
    errorRetry: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginLeft: 12 },
    noBusBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#FFFFFFFA',
      borderRadius: 16,
      paddingVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    noBusText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },

    // Directions popup (Google Maps)
    directionsCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFFF8',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    directionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    directionsInfo: { flex: 1 },
    directionsTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
    directionsSubtitle: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 3 },
    directionsModes: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    dirModeBtn: {
      alignItems: 'center',
      gap: 8,
    },
    dirModeIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dirModeLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

    // View Menu button in directions card
    viewMenuBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#F59E0B',
      marginBottom: 8,
    },
    viewMenuBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

    // Route pill inactive state
    routePillInactive: { opacity: 0.55 },
    routePillInactiveText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginLeft: 2 },

    // Alert banner
    alertBanner: {
      position: 'absolute',
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FEF3C7',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    alertBannerText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#92400E' },

    // Bus detail popup (bottom sheet)
    busPopup: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFFFA',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    busPopupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    busPopupIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    busPopupInfo: { flex: 1 },
    busPopupTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
    busPopupRoute: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 1 },
    busPopupClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    busPopupMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
    },
    busPopupMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    busPopupMetaText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
    busPopupStops: { marginTop: 14 },
    busPopupStopsLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    busPopupStopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    busPopupStopDotCol: { width: 12, alignItems: 'center' },
    busPopupStopDot: { width: 8, height: 8, borderRadius: 4 },
    busPopupStopLine: { width: 2, height: 16, marginTop: 2, backgroundColor: '#E5E7EB' },
    busPopupStopName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },
    busPopupStopEta: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    busPopupStopEtaText: { fontSize: 11, fontWeight: '700' },

    // Route schedule panel
    schedulePanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFFF8',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: 380,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    schedulePanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    schedulePanelAccent: {
      width: 4,
      height: 40,
      borderRadius: 2,
    },
    schedulePanelHeaderInfo: { flex: 1 },
    schedulePanelTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
    schedulePanelBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    schedulePanelBusCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    schedulePanelBusCountText: { fontSize: 12, fontWeight: '600' },
    scheduleContent: { maxHeight: 220 },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },
    scheduleRowContent: { flex: 1 },
    scheduleRowLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
    scheduleRowValue: { fontSize: 14, fontWeight: '500', color: '#1A1A2E', marginTop: 2 },
    liveTrackingBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 14,
      marginBottom: 8,
    },
    liveTrackingBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    scheduleNoData: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    scheduleNoDataText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 6 },

    // Web-specific styles
    webLocationList: {
      position: 'absolute',
      bottom: 80,
      left: 16,
      right: 16,
      backgroundColor: '#FFFFFFFA',
      borderRadius: 16,
      padding: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    webLocationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    webLocIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webLocName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
    webLocDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    webLocTraffic: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    webLocTrafficText: { fontSize: 11, fontWeight: '700' },

    // Dining detail bottom sheet
    diningDetailCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFFF8',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    diningDetailImage: {
      width: '100%',
      height: 140,
      borderRadius: 16,
      backgroundColor: '#F3F4F6',
      marginBottom: 14,
    },
    diningDetailInfo: {
      gap: 10,
    },
    diningDetailHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    diningDetailName: {
      fontSize: 20,
      fontWeight: '800',
      color: '#1A1A2E',
    },
    diningDetailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    diningTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#F59E0B15',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    diningTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#B45309',
    },
    diningStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    diningStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    diningStatusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    diningHoursRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    diningHoursText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#6B7280',
    },
    diningDetailDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: '#6B7280',
    },
    diningDetailButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
      marginBottom: 8,
    },
    diningMenuBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#F59E0B',
    },
    diningMenuBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFF',
    },
    diningDirBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#418FDE15',
    },
    diningDirBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#418FDE',
    },
  });
