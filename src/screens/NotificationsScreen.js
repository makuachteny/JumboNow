import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Users,
  Zap,
  Heart,
  MessageCircle,
  Calendar,
  Star,
  TrendingUp,
  Trash2,
} from 'lucide-react-native';
import { notificationsService } from '../services/notifications.service';
import { useTheme } from '../context/ThemeContext';
import { withOpacity } from '../utils/safeColor';

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsService.getNotifications();
      setNotifications(data.map((n) => {
        const minsAgo = Math.floor((Date.now() - new Date(n.created_at).getTime()) / 60000);
        let time;
        if (minsAgo < 60) time = `${minsAgo}m ago`;
        else if (minsAgo < 1440) time = `${Math.floor(minsAgo / 60)}h ago`;
        else time = `${Math.floor(minsAgo / 1440)}d ago`;
        return { ...n, time };
      }));
    } catch (err) {
      setError('Failed to load notifications. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const sub = notificationsService.subscribeToNotifications(() => fetchNotifications());
    return () => sub?.unsubscribe();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'events', label: 'Events' },
    { id: 'system', label: 'System' },
  ];

  const filteredNotifications =
    activeFilter === 'all'
      ? notifications
      : notifications.filter((n) => n.category === activeFilter);

  const markAsRead = async (id) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationsService.markAsRead(id);
    } catch (err) {
      // revert on failure
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    try {
      await notificationsService.markAllAsRead();
    } catch (err) {
      fetchNotifications();
    }
  };

  const deleteNotification = async (id) => {
    setNotifications(notifications.filter((n) => n.id !== id));
    try {
      await notificationsService.deleteNotification(id);
    } catch (err) {
      fetchNotifications();
    }
  };

  const clearAll = () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setNotifications([]);
          try {
            await notificationsService.clearAll();
          } catch (err) {
            fetchNotifications();
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.iconBtn} onPress={markAllAsRead}>
              <CheckCheck size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, activeFilter === filter.id && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[styles.filterChipText, activeFilter === filter.id && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Animated.View style={{ opacity: fadeIn }}>
          {error ? (
            <View style={styles.emptyState}>
              <Bell size={48} color={colors.accentMuted} />
              <Text style={styles.emptyTitle}>Something went wrong</Text>
              <Text style={styles.emptySubtext}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchNotifications(); }}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <BellOff size={48} color={colors.accentMuted} />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtext}>No notifications to show. Go discover some events!</Text>
            </View>
          ) : (
            <>
              {/* Unread Section */}
              {filteredNotifications.some((n) => !n.read) && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>New</Text>
                </View>
              )}
              {filteredNotifications
                .filter((n) => !n.read)
                .map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[styles.notificationCard, styles.notificationUnread]}
                    onPress={() => markAsRead(notification.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.notificationLeft}>
                      <View style={[styles.notifIconContainer, { backgroundColor: withOpacity(notification.color, '20', colors.accent) }]}>
                        <Text style={styles.notifIcon}>{notification.icon}</Text>
                      </View>
                      <View style={styles.unreadDot} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notifTitle}>{notification.title}</Text>
                      <Text style={styles.notifBody}>{notification.body}</Text>
                      <Text style={styles.notifTime}>{notification.time}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteNotification(notification.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={14} color={colors.accentMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}

              {/* Read Section */}
              {filteredNotifications.some((n) => n.read) && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Earlier</Text>
                  {notifications.length > 3 && (
                    <TouchableOpacity onPress={clearAll}>
                      <Text style={styles.clearAllText}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {filteredNotifications
                .filter((n) => n.read)
                .map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={styles.notificationCard}
                    activeOpacity={0.8}
                  >
                    <View style={styles.notificationLeft}>
                      <View style={[styles.notifIconContainer, { backgroundColor: withOpacity(notification.color, '15', colors.accent) }]}>
                        <Text style={styles.notifIcon}>{notification.icon}</Text>
                      </View>
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notifTitle, { opacity: 0.7 }]}>{notification.title}</Text>
                      <Text style={[styles.notifBody, { opacity: 0.5 }]}>{notification.body}</Text>
                      <Text style={styles.notifTime}>{notification.time}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteNotification(notification.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={14} color={colors.accentMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.accentBorder,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  headerRight: {
    width: 42,
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  filterChipText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAllText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.card,
    gap: 12,
  },
  notificationUnread: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBorder,
  },
  notificationLeft: {
    position: 'relative',
  },
  notifIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: {
    fontSize: 22,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  notificationContent: {
    flex: 1,
  },
  notifTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  notifBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  notifTime: {
    color: colors.accentMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  deleteBtn: {
    paddingTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.buttonPrimary,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
