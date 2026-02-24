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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapViewWrapper';
import {
  ArrowRight,
  ArrowUp,
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

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  // Bus tracking
  const [trackedBus, setTrackedBus] = useState(null);

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

  // Tracked bus real-time info
  const trackedBusInfo = useMemo(() => {
    if (!trackedBus) return null;
    const currentBus = buses.find((b) => b.busId === trackedBus.busId);
    if (!currentBus) return { lost: true };

    const routeId = currentBus.routeId;
    const route = routes.find((r) => r.myid === routeId);
    const color = currentBus.color || route?.color || colors.accent;
    const routeName = currentBus.route || route?.name || 'Unknown Route';
    const busName = currentBus.busName || currentBus.busId;

    // Speed from API in mph, default 12 mph for campus shuttles
    const speedMph = parseFloat(currentBus.speed) || 12;
    const speedMs = speedMph * 0.44704; // convert mph to m/s
    const heading = parseFloat(currentBus.calculatedCourse) || 0;

    const busLat = parseFloat(currentBus.latitude);
    const busLon = parseFloat(currentBus.longitude);

    // Find all stops on this route
    const stopsOnRoute = stops.filter((s) => s.routeIds?.includes(routeId));
    const nextStops = stopsOnRoute
      .map((s) => {
        const dist = haversineDistance(busLat, busLon, parseFloat(s.latitude), parseFloat(s.longitude));
        const etaSeconds = speedMs > 0 ? dist / speedMs : 0;
        const etaMinutes = Math.max(1, Math.round(etaSeconds / 60));
        return {
          name: s.name,
          eta: etaMinutes,
          etaLabel: etaMinutes < 60 ? `${etaMinutes} min` : `${Math.floor(etaMinutes / 60)} hr ${etaMinutes % 60} min`,
          distance: formatDistance(dist),
          distanceMeters: dist,
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);

    return { currentBus, color, routeName, busName, speedMph, heading, nextStops };
  }, [trackedBus, buses, routes, stops, colors.accent]);

  // Visible route path — trailing effect when tracking
  const visibleRoutePath = useMemo(() => {
    if (!busRoutePath || !busRoutePath.coords || busRoutePath.coords.length < 2) return null;
    if (!trackedBus || !trackedBusInfo || trackedBusInfo.lost) {
      return busRoutePath; // full path when not tracking
    }
    const busLat = parseFloat(trackedBusInfo.currentBus.latitude);
    const busLon = parseFloat(trackedBusInfo.currentBus.longitude);

    // Find closest point index on the route
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < busRoutePath.coords.length; i++) {
      const c = busRoutePath.coords[i];
      const d = haversineDistance(busLat, busLon, c.latitude, c.longitude);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    const aheadCoords = busRoutePath.coords.slice(closestIdx);
    if (aheadCoords.length < 2) return busRoutePath; // fallback to full if too short
    return { ...busRoutePath, coords: aheadCoords };
  }, [busRoutePath, trackedBus, trackedBusInfo]);

  // Auto-follow tracked bus on map
  useEffect(() => {
    if (!trackedBus || !trackedBusInfo || trackedBusInfo.lost || !mapRef.current) return;
    const { currentBus } = trackedBusInfo;
    mapRef.current.animateToRegion({
      latitude: parseFloat(currentBus.latitude),
      longitude: parseFloat(currentBus.longitude),
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    }, 500);
  }, [trackedBusInfo, trackedBus]);

  // Auto-exit tracking if bus disappears
  useEffect(() => {
    if (trackedBusInfo?.lost) {
      setTrackedBus(null);
    }
  }, [trackedBusInfo]);

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

  // Auto-fit map to active buses when they update (skip when tracking)
  useEffect(() => {
    if (trackedBus) return;
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
          edgePadding: { top: 180, right: 60, bottom: 320, left: 60 },
          animated: true,
        });
      }
    }
  }, [filteredBuses, selectedRoute, loading, trackedBus]);

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
            edgePadding: { top: 180, right: 60, bottom: 320, left: 60 },
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
    setTrackedBus(null);
    setSelectedStop(stop);
    mapRef.current?.animateToRegion({
      latitude: stop.latitude,
      longitude: stop.longitude,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    }, 300);
  }, [navigating, cancelNavigation]);

  // --- Panel content renderer ---
  const renderPanelContent = () => {
    // Priority 1: Error
    if (error) {
      return (
        <View style={styles.panelError}>
          <Text style={styles.panelErrorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); loadData(); }}>
            <Text style={styles.panelErrorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Priority 2: Tracking a bus
    if (trackedBus && trackedBusInfo && !trackedBusInfo.lost) {
      return (
        <View>
          {/* Tracking header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.trackingIcon, { backgroundColor: trackedBusInfo.color }]}>
              <Bus size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackingRoute} numberOfLines={1}>{trackedBusInfo.routeName}</Text>
              <Text style={styles.trackingSub}>Bus {trackedBusInfo.busName}</Text>
            </View>
            <View style={styles.trackingMeta}>
              <View style={styles.trackingLiveRow}>
                <View style={styles.trackingLiveDot} />
                <Text style={styles.trackingSpeed}>{Math.round(trackedBusInfo.speedMph)} mph</Text>
              </View>
              <View style={{ transform: [{ rotate: `${trackedBusInfo.heading}deg` }] }}>
                <ArrowUp size={16} color={trackedBusInfo.color} />
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setTrackedBus(null)}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Arrival Timeline */}
          {trackedBusInfo.nextStops.length > 0 && (
            <View style={styles.timeline}>
              <Text style={styles.timelineLabel}>Arriving at</Text>
              {trackedBusInfo.nextStops.map((stop, idx) => {
                const isNearest = idx === 0;
                return (
                  <View key={stop.name} style={styles.timelineRow}>
                    <View style={styles.timelineDotCol}>
                      <View style={[
                        styles.timelineDot,
                        { backgroundColor: isNearest ? trackedBusInfo.color : '#D1D5DB' },
                      ]} />
                      {idx < trackedBusInfo.nextStops.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: '#E5E7EB' }]} />
                      )}
                    </View>
                    <Text
                      style={[styles.timelineStop, isNearest && styles.timelineStopBold]}
                      numberOfLines={1}
                    >
                      {stop.name}
                    </Text>
                    <View style={[
                      styles.etaBadge,
                      { backgroundColor: isNearest ? trackedBusInfo.color + '18' : '#F3F4F6' },
                    ]}>
                      <Text style={[
                        styles.etaText,
                        { color: isNearest ? trackedBusInfo.color : '#6B7280' },
                      ]}>
                        {stop.etaLabel}
                      </Text>
                    </View>
                    <Text style={styles.distText}>{stop.distance}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    // Priority 3: Walking navigation
    if (navigating && navPath) {
      return (
        <View>
          <View style={styles.navRow}>
            <View style={styles.navIcon}>
              <Footprints size={18} color="#4285F4" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle} numberOfLines={1}>Walking to {navPath.destination}</Text>
              <View style={styles.navDetails}>
                <Text style={styles.navDuration}>{navPath.duration}</Text>
                <View style={styles.navDotSep} />
                <Text style={styles.navDist}>{navPath.distance}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={cancelNavigation}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View style={styles.navProgress}>
            <View style={styles.navProgressFill} />
          </View>
        </View>
      );
    }

    // Priority 4: Selected stop
    if (selectedStop) {
      return (
        <View>
          <View style={styles.stopRow}>
            <View style={[styles.stopIcon, { backgroundColor: (selectedStop.color || colors.accent) + '18' }]}>
              <CircleDot size={18} color={selectedStop.color || colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopName}>{selectedStop.name}</Text>
              <Text style={styles.stopRoutes}>
                {selectedStop.routeNames?.join(' \u2022 ') || 'Shuttle stop'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedStop(null)}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => startNavigation(selectedStop)}
          >
            <Navigation size={14} color="#FFF" />
            <Text style={styles.directionsBtnText}>Directions</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Priority 5: Fetching path
    if (fetchingPath) {
      return (
        <View style={styles.panelLoading}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.panelLoadingText}>Loading route...</Text>
        </View>
      );
    }

    // Priority 6: Bus list
    if (filteredBuses.length > 0) {
      return (
        <ScrollView style={styles.busList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {filteredBuses.map((bus) => (
            <TouchableOpacity
              key={bus.busId}
              style={styles.busRow}
              onPress={() => {
                setTrackedBus(bus);
                const busRoute = routes.find((r) => r.myid === bus.routeId);
                if (busRoute) setSelectedRoute(busRoute);
                setSelectedStop(null);
                cancelNavigation();
              }}
            >
              <View style={[styles.busRowIcon, { backgroundColor: bus.color || colors.accent }]}>
                <Bus size={14} color="#FFF" />
              </View>
              <Text style={styles.busRowRoute} numberOfLines={1}>{bus.route}</Text>
              <Text style={styles.busRowName}>Bus {bus.busName}</Text>
              <View style={styles.busRowLive}>
                <View style={styles.busRowLiveDot} />
                <Text style={styles.busRowLiveText}>Live</Text>
              </View>
              <ArrowRight size={14} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    // Priority 7: No buses
    return (
      <View style={styles.panelEmpty}>
        <Bus size={18} color="#9CA3AF" />
        <Text style={styles.panelEmptyText}>No shuttles currently in service</Text>
      </View>
    );
  };

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
          {/* Bus route path — trailing effect when tracking */}
          {visibleRoutePath && visibleRoutePath.coords.length >= 2 && (
            <Polyline
              coordinates={visibleRoutePath.coords}
              strokeColor={visibleRoutePath.color}
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowRight size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <View style={styles.topBarTitleRow}>
            <Bus size={16} color={colors.accent} />
            <Text style={styles.topBarTitle}>Shuttles</Text>
          </View>
          {lastUpdated && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && styles.refreshBtnActive]}
          onPress={handleRefresh}
          accessibilityLabel="Refresh shuttle data"
          accessibilityRole="button"
        >
          <RefreshCw size={18} color={refreshing ? '#FFF' : '#1A1A2E'} />
        </TouchableOpacity>
      </View>

      {/* Consolidated Bottom Panel */}
      {!loading && (
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Handle */}
          <View style={styles.panelHandle} />

          {/* Content Area */}
          <View style={styles.panelContent}>
            {renderPanelContent()}
          </View>
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFEE',
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
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFEE',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  refreshBtnActive: { backgroundColor: colors.accent },

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

  // ── Bottom Panel ──
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFFFA',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  panelHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 10,
  },

  panelContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },

  // Error content
  panelError: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEE2E2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  panelErrorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', flex: 1 },
  panelErrorRetry: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginLeft: 12 },

  // Close button (shared)
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  // Tracking content
  trackingIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  trackingRoute: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  trackingSub: { fontSize: 12, fontWeight: '400', color: '#6B7280', marginTop: 1 },
  trackingMeta: { alignItems: 'center', gap: 2 },
  trackingLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackingLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  trackingSpeed: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  timeline: { marginTop: 14, paddingBottom: 2 },
  timelineLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  timelineDotCol: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, height: 18, marginTop: 3 },
  timelineStop: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },
  timelineStopBold: { fontWeight: '700', color: '#1A1A2E' },
  etaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  etaText: { fontSize: 11, fontWeight: '700' },
  distText: { fontSize: 10, fontWeight: '500', color: '#9CA3AF', width: 48, textAlign: 'right' },

  // Navigation content
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#4285F414',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  navDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  navDuration: { fontSize: 13, fontWeight: '600', color: '#4285F4' },
  navDotSep: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  navDist: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  navProgress: {
    height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 12, overflow: 'hidden',
  },
  navProgressFill: { width: '100%', height: '100%', borderRadius: 2, backgroundColor: '#4285F4' },

  // Stop details content
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  stopName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  stopRoutes: { fontSize: 12, fontWeight: '400', color: '#6B7280', marginTop: 1 },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4285F4', borderRadius: 12, paddingVertical: 12, marginTop: 12,
  },
  directionsBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Bus list content
  busList: { maxHeight: 200 },
  busRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  busRowIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  busRowRoute: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  busRowName: { fontSize: 12, fontWeight: '400', color: '#6B7280' },
  busRowLive: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  busRowLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  busRowLiveText: { fontSize: 10, fontWeight: '600', color: colors.success },

  // Empty / loading states
  panelEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  panelEmptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
  panelLoading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  panelLoadingText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
});
