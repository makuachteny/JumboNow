import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowRight,
  Bus,
  RefreshCw,
  X,
  Navigation,
  CircleDot,
  Footprints,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TUFTS_REGION = {
  latitude: 42.405,
  longitude: -71.119,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

const PASSIO_API = 'https://passio3.com/www/mapGetData.php';
const SYSTEM_ID = '6670';
async function fetchRoutes() {
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

// Decode Google encoded polyline into coordinate array
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

// Fetch road-following route from OSRM (free, no API key)
async function fetchRoute(points, mode = 'driving') {
  if (points.length < 2) return null;
  // OSRM uses lng,lat order separated by semicolons
  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const route = data.routes[0];
      return {
        coords: decodePolyline(route.geometry),
        totalDistance: route.distance, // meters
        // Walking: estimate at ~1.4 m/s (avg walk speed)
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

export default function ShuttleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [stops, setStops] = useState([]);
  const [routeStops, setRouteStops] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic bus route path (only shown when bus is active)
  const [busRoutePath, setBusRoutePath] = useState(null);
  const [fetchingPath, setFetchingPath] = useState(false);

  // In-app walking navigation
  const [navPath, setNavPath] = useState(null);
  const [navigating, setNavigating] = useState(false);

  const mapRef = useRef(null);
  const busInterval = useRef(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pathCache = useRef({});

  // Swipe right to go back to Home
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        return dx > 15 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderMove: (_, { dx }) => {
        if (dx > 0) slideAnim.setValue(dx);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx > 80 || vx > 0.5) {
          Animated.timing(slideAnim, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const [routesData, busesData, stopsData] = await Promise.all([
        fetchRoutes(),
        fetchBuses(),
        fetchStops(),
      ]);

      // Process routes
      const activeRoutes = Array.isArray(routesData)
        ? routesData.filter((r) => r.outdated === '0' || !r.serviceTimeShort)
        : [];
      const allRoutes = Array.isArray(routesData) ? routesData : [];
      setRoutes(activeRoutes.length > 0 ? activeRoutes : allRoutes);

      // Process buses
      const busArray = [];
      if (busesData?.buses) {
        Object.values(busesData.buses).forEach((deviceBuses) => {
          deviceBuses.forEach((b) => {
            if (b.latitude && b.longitude && !b.outOfService) {
              busArray.push(b);
            }
          });
        });
      }
      setBuses(busArray);

      // Process stops - deduplicate and track ordered stops per route
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
      // Sort stops per route by position
      Object.keys(orderedByRoute).forEach((routeId) => {
        orderedByRoute[routeId].sort((a, b) => a.position - b.position);
        const deduped = [];
        orderedByRoute[routeId].forEach((coord) => {
          const last = deduped[deduped.length - 1];
          if (!last || last.latitude !== coord.latitude || last.longitude !== coord.longitude) {
            deduped.push(coord);
          }
        });
        orderedByRoute[routeId] = deduped;
      });
      setRouteStops(orderedByRoute);
      setStops(Object.values(stopMap));
      setLastUpdated(new Date());
    } catch (err) {
      setError('Could not load shuttle data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh buses every 10 seconds
  const refreshBuses = useCallback(async () => {
    try {
      const busesData = await fetchBuses();
      const busArray = [];
      if (busesData?.buses) {
        Object.values(busesData.buses).forEach((deviceBuses) => {
          deviceBuses.forEach((b) => {
            if (b.latitude && b.longitude && !b.outOfService) {
              busArray.push(b);
            }
          });
        });
      }
      setBuses(busArray);
      setLastUpdated(new Date());
    } catch (_) {
      // Silently fail on bus refresh
    }
  }, []);

  useEffect(() => {
    loadData();
    busInterval.current = setInterval(refreshBuses, 10000);
    return () => {
      if (busInterval.current) clearInterval(busInterval.current);
    };
  }, [loadData, refreshBuses]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    pathCache.current = {};
    setBusRoutePath(null);
    loadData(true);
  }, [loadData]);

  const filteredStops = useMemo(() => {
    if (!selectedRoute) return stops;
    return stops.filter((s) => s.routeIds.includes(selectedRoute.myid));
  }, [stops, selectedRoute]);

  const filteredBuses = useMemo(() => {
    if (!selectedRoute) return buses;
    return buses.filter((b) => b.routeId === selectedRoute.myid);
  }, [buses, selectedRoute]);

  // Fetch road-following path when a route with active buses is selected
  useEffect(() => {
    if (!selectedRoute) {
      setBusRoutePath(null);
      return;
    }

    const routeId = selectedRoute.myid;
    const activeBuses = buses.filter((b) => b.routeId === routeId);
    const orderedStops = routeStops[routeId];

    // Only show path when buses are active
    if (activeBuses.length === 0 || !orderedStops || orderedStops.length < 2) {
      setBusRoutePath(null);
      return;
    }

    // Use cached path if available
    if (pathCache.current[routeId]) {
      setBusRoutePath({
        coords: pathCache.current[routeId],
        color: selectedRoute.color || colors.accent,
      });
      return;
    }

    // Fetch road-following route via OSRM
    const loadPath = async () => {
      setFetchingPath(true);
      // Build circular route: all stops then back to first
      const points = [...orderedStops, { latitude: orderedStops[0].latitude, longitude: orderedStops[0].longitude }];
      const result = await fetchRoute(points, 'driving');
      if (result && result.coords.length > 0) {
        pathCache.current[routeId] = result.coords;
        setBusRoutePath({
          coords: result.coords,
          color: selectedRoute.color || colors.accent,
        });
      }
      setFetchingPath(false);
    };
    loadPath();
  }, [selectedRoute, buses, routeStops, colors.accent]);

  // Auto-fit map to active buses when they update
  useEffect(() => {
    if (!mapRef.current || loading || !selectedRoute) return;

    const coords = [];
    filteredBuses.forEach((b) => {
      coords.push({ latitude: parseFloat(b.latitude), longitude: parseFloat(b.longitude) });
    });

    if (coords.length > 0) {
      // If only one bus, zoom close to it
      if (coords.length === 1) {
        mapRef.current.animateToRegion({
          ...coords[0],
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 500);
      } else {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 180, right: 60, bottom: 220, left: 60 },
          animated: true,
        });
      }
    }
  }, [filteredBuses, selectedRoute, loading]);

  // In-app walking directions to a stop
  const startNavigation = useCallback(async (stop) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Enable location to get directions.');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = position.coords;
      const userPos = { latitude, longitude };
      const stopPos = { latitude: parseFloat(stop.latitude), longitude: parseFloat(stop.longitude) };

      const result = await fetchRoute([userPos, stopPos], 'walking');
      if (result) {
        setNavPath({
          coords: result.coords,
          distance: formatDistance(result.totalDistance),
          duration: formatDuration(result.totalDuration),
          destination: stop.name,
        });
        setNavigating(true);
        setSelectedStop(null);

        if (mapRef.current && result.coords.length > 0) {
          mapRef.current.fitToCoordinates(result.coords, {
            edgePadding: { top: 180, right: 60, bottom: 260, left: 60 },
            animated: true,
          });
        }
      }
    } catch (e) {
      setError('Could not get your location.');
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  const cancelNavigation = useCallback(() => {
    setNavPath(null);
    setNavigating(false);
  }, []);

  const handleStopPress = useCallback((stop) => {
    if (navigating) cancelNavigation();
    setSelectedStop(stop);
    mapRef.current?.animateToRegion({
      latitude: stop.latitude,
      longitude: stop.longitude,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    }, 300);
  }, [navigating, cancelNavigation]);

  const timeAgo = lastUpdated
    ? `${Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))}s ago`
    : '';

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideAnim }] }]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="dark-content" />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading shuttles...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
          initialRegion={TUFTS_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsBuildings
          showsIndoors
          showsPointsOfInterest
        >
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

          {/* Stop markers */}
          {filteredStops.map((stop) => (
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

          {/* Bus markers */}
          {filteredBuses.map((bus) => (
            <Marker
              key={`bus-${bus.busId}`}
              coordinate={{ latitude: parseFloat(bus.latitude), longitude: parseFloat(bus.longitude) }}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={parseFloat(bus.calculatedCourse) || 0}
              flat
            >
              <View style={[styles.busMarker, { backgroundColor: bus.color || colors.accent }]}>
                <Bus size={16} color="#FFF" />
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowRight size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <View style={styles.topBarTitleRow}>
            <Bus size={16} color={colors.accent} />
            <Text style={styles.topBarTitle}>Tufts Shuttles</Text>
          </View>
          {lastUpdated && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live {timeAgo}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && styles.refreshBtnActive]}
          onPress={handleRefresh}
        >
          <RefreshCw size={18} color={refreshing ? '#FFF' : '#1A1A2E'} />
        </TouchableOpacity>
      </View>

      {/* Route Filter Pills */}
      <View style={styles.routeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeScroll}
        >
          <TouchableOpacity
            style={[styles.routePill, !selectedRoute && styles.routePillActive]}
            onPress={() => { setSelectedRoute(null); setSelectedStop(null); setBusRoutePath(null); cancelNavigation(); }}
          >
            <Text style={[styles.routePillText, !selectedRoute && styles.routePillTextActive]}>
              All Routes
            </Text>
          </TouchableOpacity>
          {routes.map((route) => {
            const isActive = selectedRoute?.myid === route.myid;
            const busCount = buses.filter((b) => b.routeId === route.myid).length;
            return (
              <TouchableOpacity
                key={route.myid}
                style={[styles.routePill, isActive && { backgroundColor: route.color }]}
                onPress={() => {
                  setSelectedRoute(isActive ? null : route);
                  setSelectedStop(null);
                  if (isActive) { setBusRoutePath(null); cancelNavigation(); }
                }}
              >
                <View style={[styles.routeColorDot, { backgroundColor: isActive ? '#FFF' : route.color }]} />
                <Text style={[styles.routePillText, isActive && styles.routePillTextActive]} numberOfLines={1}>
                  {route.name}
                </Text>
                {busCount > 0 && (
                  <View style={[styles.busCountBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : route.color + '20' }]}>
                    <Text style={[styles.busCountText, { color: isActive ? '#FFF' : route.color }]}>{busCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Fetching path indicator */}
      {fetchingPath && (
        <View style={styles.fetchingBar}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.fetchingText}>Loading route...</Text>
        </View>
      )}

      {/* Walking Navigation Card */}
      {navigating && navPath && (
        <View style={[styles.navCard, { bottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.navCardHeader}>
            <View style={styles.navCardIconWrap}>
              <Footprints size={20} color="#4285F4" />
            </View>
            <View style={styles.navCardInfo}>
              <Text style={styles.navCardTitle} numberOfLines={1}>Walking to {navPath.destination}</Text>
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

      {/* Active Buses Info Bar */}
      {buses.length > 0 && !selectedStop && !navigating && (
        <View style={[styles.busInfoBar, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
          {filteredBuses.map((bus) => (
            <TouchableOpacity
              key={bus.busId}
              style={styles.busInfoCard}
              onPress={() => {
                mapRef.current?.animateToRegion({
                  latitude: parseFloat(bus.latitude),
                  longitude: parseFloat(bus.longitude),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 300);
              }}
            >
              <View style={[styles.busInfoIcon, { backgroundColor: bus.color || colors.accent }]}>
                <Bus size={14} color="#FFF" />
              </View>
              <View style={styles.busInfoText}>
                <Text style={styles.busInfoRoute} numberOfLines={1}>{bus.route}</Text>
                <Text style={styles.busInfoName}>Bus {bus.busName}</Text>
              </View>
              <View style={styles.busInfoLive}>
                <View style={[styles.liveDotSmall, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.busInfoLiveText}>Live</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Selected Stop Card */}
      {selectedStop && !navigating && (
        <View style={[styles.stopCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.stopCardHeader}>
            <View style={[styles.stopCardIcon, { backgroundColor: (selectedStop.color || colors.accent) + '18' }]}>
              <CircleDot size={20} color={selectedStop.color || colors.accent} />
            </View>
            <View style={styles.stopCardInfo}>
              <Text style={styles.stopCardName}>{selectedStop.name}</Text>
              <Text style={styles.stopCardRoutes}>
                {selectedStop.routeNames?.join(' \u2022 ') || 'Shuttle stop'}
              </Text>
            </View>
            <TouchableOpacity style={styles.stopCardClose} onPress={() => setSelectedStop(null)}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => startNavigation(selectedStop)}
          >
            <Navigation size={16} color="#FFF" />
            <Text style={styles.directionsBtnText}>Directions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error overlay */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); loadData(); }}>
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* No buses message */}
      {!loading && buses.length === 0 && !error && (
        <View style={[styles.noBusBar, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Bus size={18} color="#9CA3AF" />
          <Text style={styles.noBusText}>No shuttles currently in service</Text>
        </View>
      )}
    </Animated.View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  map: { ...StyleSheet.absoluteFillObject },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFFEE',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarCenter: {
    flex: 1, backgroundColor: '#FFFFFFEE', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  liveText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFFEE',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  refreshBtnActive: { backgroundColor: colors.accent },

  // Route pills
  routeBar: { position: 'absolute', top: 120, left: 0, right: 0 },
  routeScroll: { paddingHorizontal: 16, gap: 8 },
  routePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFFEE',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  routePillActive: { backgroundColor: colors.buttonPrimary },
  routeColorDot: { width: 8, height: 8, borderRadius: 4 },
  routePillText: { fontSize: 13, fontWeight: '600', color: '#374151', maxWidth: 130 },
  routePillTextActive: { color: '#FFF' },
  busCountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 2 },
  busCountText: { fontSize: 10, fontWeight: '700' },

  // Fetching indicator
  fetchingBar: {
    position: 'absolute', top: 165, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFFEE', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  fetchingText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },

  // Stop markers
  stopMarker: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFFEE',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  stopMarkerSelected: { borderColor: colors.accent, borderWidth: 2.5, transform: [{ scale: 1.2 }] },
  stopDot: { width: 10, height: 10, borderRadius: 5 },

  // Bus markers
  busMarker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },

  // Bus info bar
  busInfoBar: { position: 'absolute', left: 16, right: 16 },
  busInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFFFA', borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  busInfoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  busInfoText: { flex: 1 },
  busInfoRoute: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  busInfoName: { fontSize: 12, fontWeight: '400', color: '#6B7280', marginTop: 1 },
  busInfoLive: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3 },
  busInfoLiveText: { fontSize: 11, fontWeight: '600', color: '#22C55E' },

  // Stop card
  stopCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFFFA', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  stopCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stopCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopCardInfo: { flex: 1 },
  stopCardName: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  stopCardRoutes: { fontSize: 13, fontWeight: '400', color: '#6B7280', marginTop: 2 },
  stopCardClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4285F4', borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  directionsBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Navigation card
  navCard: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: '#FFFFFFFA', borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 10,
  },
  navCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navCardIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#4285F414',
    alignItems: 'center', justifyContent: 'center',
  },
  navCardInfo: { flex: 1 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  navCardDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  navCardDuration: { fontSize: 14, fontWeight: '600', color: '#4285F4' },
  navCardDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  navCardDistance: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  navCardClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  navCardProgress: {
    height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 14, overflow: 'hidden',
  },
  navCardProgressFill: { width: '100%', height: '100%', borderRadius: 2 },

  // Error
  errorBar: {
    position: 'absolute', top: 170, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEE2E2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', flex: 1 },
  errorRetry: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginLeft: 12 },

  // No bus
  noBusBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFFFA', borderRadius: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  noBusText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
});
