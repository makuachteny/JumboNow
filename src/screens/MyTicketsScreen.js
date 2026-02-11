import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Ticket,
  Calendar,
  MapPin,
  Clock,
  Search,
  XCircle,
  Star,
  Trash2,
} from 'lucide-react-native';
import { ticketsService } from '../services/tickets.service';
import { useTheme } from '../context/ThemeContext';
import { withOpacity } from '../utils/safeColor';
import BottomNav from '../components/BottomNav';

export default function MyTicketsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [ratingsState, setRatingsState] = useState({});

  const fetchTickets = useCallback(async () => {
    try {
      setError(null);
      const data = await ticketsService.getMyTickets();
      setTickets(data);
    } catch (err) {
      setError('Failed to load tickets. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const sub = ticketsService.subscribeToReservations(() => fetchTickets());
    return () => { sub?.unsubscribe(); };
  }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const handleStarPress = useCallback((ticketId, star) => {
    setRatingsState((prev) => ({
      ...prev,
      [ticketId]: { ...prev[ticketId], stars: star, expanded: true },
    }));
  }, []);

  const handleFeedbackChange = useCallback((ticketId, text) => {
    setRatingsState((prev) => ({
      ...prev,
      [ticketId]: { ...prev[ticketId], feedback: text },
    }));
  }, []);

  const handleSubmitRating = useCallback(async (ticketId) => {
    const state = ratingsState[ticketId];
    if (!state?.stars) return;
    setRatingsState((prev) => ({
      ...prev,
      [ticketId]: { ...prev[ticketId], submitting: true },
    }));
    try {
      await ticketsService.submitRating(ticketId, state.stars, state.feedback || '');
      setRatingsState((prev) => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], submitting: false, submitted: true },
      }));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit rating.');
      setRatingsState((prev) => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], submitting: false },
      }));
    }
  }, [ratingsState]);

  const handleCancel = useCallback((ticket) => {
    const event = ticket.event;
    Alert.alert(
      'Cancel Reservation',
      `Cancel your reservation for "${event?.title}"?${ticket.price_paid > 0 ? '\n\nNote: Refund policies may apply for paid tickets.' : ''}`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Reservation',
          style: 'destructive',
          onPress: async () => {
            try {
              await ticketsService.cancelReservation(ticket.id);
              Alert.alert('Cancelled', 'Your reservation has been cancelled.');
              fetchTickets();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to cancel reservation.');
            }
          },
        },
      ],
    );
  }, [fetchTickets]);

  const handleDelete = useCallback((ticket) => {
    const event = ticket.event;
    Alert.alert(
      'Delete Ticket',
      `Remove "${event?.title}" from your ticket history? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ticketsService.deleteReservation(ticket.id);
              fetchTickets();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete ticket.');
            }
          },
        },
      ],
    );
  }, [fetchTickets]);

  const now = new Date();
  const upcomingTickets = tickets.filter((t) => t.event && new Date(t.event.end_time) >= now && t.status !== 'cancelled');
  const pastTickets = tickets.filter((t) => t.event && (new Date(t.event.end_time) < now || t.status === 'cancelled'));
  const displayTickets = activeTab === 'upcoming' ? upcomingTickets : pastTickets;

  const statusColors = {
    confirmed: colors.success,
    waitlisted: colors.warning,
    cancelled: colors.error,
  };

  const renderTicket = useCallback(({ item: ticket }) => {
    const event = ticket.event;
    if (!event) return null;
    const start = new Date(event.start_time);
    const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const accentColor = event.gradient_colors?.[0] || event.color || colors.accent;
    const canCancel = ticket.status === 'confirmed' && activeTab === 'upcoming';

    return (
      <TouchableOpacity
        style={styles.ticketCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
        activeOpacity={0.8}
        accessibilityLabel={`Ticket for ${event.title}`}
        accessibilityRole="button"
      >
        <View style={[styles.ticketAccent, { backgroundColor: accentColor }]} />
        <View style={styles.ticketContent}>
          <View style={styles.ticketTop}>
            <View style={[styles.ticketIconWrap, { backgroundColor: withOpacity(accentColor, '20', colors.accent) }]}>
              <Text style={styles.ticketIcon}>{event.icon || '\uD83C\uDFAB'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.ticketOrganizer}>{event.organizer_name || 'Tufts University'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColors[ticket.status] || colors.accent, '20', colors.accent) }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors[ticket.status] || colors.accent }]} />
              <Text style={[styles.statusText, { color: statusColors[ticket.status] || colors.accent }]}>
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.ticketMeta}>
            <View style={styles.ticketMetaItem}>
              <Calendar size={12} color={colors.textTertiary} />
              <Text style={styles.ticketMetaText}>{dateStr}</Text>
            </View>
            <View style={styles.ticketMetaItem}>
              <Clock size={12} color={colors.textTertiary} />
              <Text style={styles.ticketMetaText}>{timeStr}</Text>
            </View>
            <View style={styles.ticketMetaItem}>
              <MapPin size={12} color={colors.textTertiary} />
              <Text style={styles.ticketMetaText} numberOfLines={1}>{event.location}</Text>
            </View>
          </View>

          {Platform.OS === 'ios' && canCancel && ticket.status === 'confirmed' && (
            <TouchableOpacity
              style={styles.walletBtn}
              onPress={async () => {
                try {
                  const { data: { session } } = await ticketsService.getSession();
                  const token = session?.access_token;
                  if (!token) {
                    Alert.alert('Error', 'Please sign in to add to wallet.');
                    return;
                  }
                  const url = ticketsService.getWalletPassUrl(ticket.id) + `&token=${token}`;
                  await Linking.openURL(url);
                } catch (err) {
                  Alert.alert('Error', 'Could not open Apple Wallet.');
                }
              }}
              accessibilityLabel="Add to Apple Wallet"
              accessibilityRole="button"
            >
              <Text style={styles.walletBtnText}>Add to Apple Wallet</Text>
            </TouchableOpacity>
          )}

          <View style={styles.ticketFooter}>
            <TouchableOpacity
              style={styles.codeWrap}
              onPress={async () => {
                await Clipboard.setStringAsync(ticket.confirmation_code);
                Alert.alert('Copied!', 'Confirmation code copied to clipboard.');
              }}
              accessibilityLabel="Copy confirmation code"
              accessibilityRole="button"
            >
              <Text style={styles.codeLabel}>Code:</Text>
              <Text style={styles.codeValue}>{ticket.confirmation_code}</Text>
              <Text style={styles.codeCopy}>Copy</Text>
            </TouchableOpacity>
            <View style={styles.footerRight}>
              {ticket.price_paid > 0 && (
                <Text style={styles.ticketPrice}>${ticket.price_paid}</Text>
              )}
              {canCancel && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancel(ticket)}
                  accessibilityLabel="Cancel reservation"
                  accessibilityRole="button"
                >
                  <XCircle size={14} color={colors.error} />
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              {activeTab === 'past' && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(ticket)}
                  accessibilityLabel="Delete ticket"
                  accessibilityRole="button"
                >
                  <Trash2 size={14} color={colors.error} />
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Rating section for past tickets */}
          {(() => {
            const isPast = new Date(event.end_time) < now && ticket.status !== 'cancelled';
            const alreadyRated = ticket.rating != null;
            const localState = ratingsState[ticket.id] || {};
            const submitted = localState.submitted;

            if (!isPast) return null;

            if (alreadyRated || submitted) {
              const displayRating = alreadyRated ? ticket.rating : localState.stars;
              return (
                <View style={styles.ratingSection}>
                  <View style={styles.ratingStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={20}
                        color="#FACC15"
                        fill={s <= displayRating ? '#FACC15' : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingThanks}>Thanks for your feedback!</Text>
                </View>
              );
            }

            return (
              <View style={styles.ratingSection}>
                <Text style={styles.ratingPrompt}>How was this event?</Text>
                <View style={styles.ratingStarsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => handleStarPress(ticket.id, s)}
                      accessibilityLabel={`Rate ${s} star${s > 1 ? 's' : ''}`}
                      accessibilityRole="button"
                    >
                      <Star
                        size={24}
                        color="#FACC15"
                        fill={s <= (localState.stars || 0) ? '#FACC15' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {localState.expanded && (
                  <View style={styles.ratingExpanded}>
                    <TextInput
                      style={styles.feedbackInput}
                      placeholder="Any feedback? (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={localState.feedback || ''}
                      onChangeText={(text) => handleFeedbackChange(ticket.id, text)}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity
                      style={[styles.submitRatingBtn, localState.submitting && { opacity: 0.6 }]}
                      onPress={() => handleSubmitRating(ticket.id)}
                      disabled={localState.submitting}
                      accessibilityLabel="Submit rating"
                      accessibilityRole="button"
                    >
                      {localState.submitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.submitRatingText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  }, [colors, styles, activeTab, navigation, handleCancel, handleDelete, statusColors, ratingsState, handleStarPress, handleFeedbackChange, handleSubmitRating]);

  const ListEmpty = () => {
    if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
    if (error) return (
      <View style={styles.emptyState}>
        <Ticket size={48} color={colors.accentMuted} />
        <Text style={styles.emptyTitle}>Something went wrong</Text>
        <Text style={styles.emptySubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchTickets(); }} accessibilityLabel="Retry" accessibilityRole="button">
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={styles.emptyState}>
        <Ticket size={48} color={colors.accentMuted} />
        <Text style={styles.emptyTitle}>
          {activeTab === 'upcoming' ? 'No upcoming tickets' : 'No past tickets'}
        </Text>
        <Text style={styles.emptySubtext}>
          {activeTab === 'upcoming' ? 'Reserve a spot or buy a ticket to get started!' : 'Your event history will appear here.'}
        </Text>
        {activeTab === 'upcoming' && (
          <TouchableOpacity style={styles.exploreCta} onPress={() => navigation.navigate('Home')} accessibilityLabel="Explore events" accessibilityRole="button">
            <Search size={16} color="#FFF" />
            <Text style={styles.exploreCtaText}>Explore Events</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tickets</Text>
        {upcomingTickets.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{upcomingTickets.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
          accessibilityLabel={`Upcoming tickets (${upcomingTickets.length})`}
          accessibilityRole="button"
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingTickets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
          accessibilityLabel={`Past tickets (${pastTickets.length})`}
          accessibilityRole="button"
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past ({pastTickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayTickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingHorizontal: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={ListEmpty}
      />

      <BottomNav navigation={navigation} activeTab="MyTickets" />
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  countBadge: { backgroundColor: colors.accentBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  tabActive: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  tabText: { color: colors.accentMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.accent },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  exploreCta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.buttonPrimary },
  exploreCtaText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  ticketCard: { flexDirection: 'row', marginBottom: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  ticketAccent: { width: 5 },
  ticketContent: { flex: 1, padding: 14, gap: 12 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ticketIcon: { fontSize: 24 },
  ticketTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ticketOrganizer: { color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  ticketMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ticketMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ticketMetaText: { color: colors.textTertiary, fontSize: 11, fontWeight: '500' },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '600' },
  codeValue: { color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  codeCopy: { color: colors.accentMuted, fontSize: 10, fontWeight: '600', marginLeft: 4 },
  ticketPrice: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  walletBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  walletBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)' },
  cancelText: { color: colors.error, fontSize: 11, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)' },
  deleteText: { color: colors.error, fontSize: 11, fontWeight: '700' },
  ratingSection: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.glassBorder, gap: 8 },
  ratingPrompt: { color: colors.text, fontSize: 13, fontWeight: '700' },
  ratingStarsRow: { flexDirection: 'row', gap: 6 },
  ratingThanks: { color: colors.success, fontSize: 12, fontWeight: '600' },
  ratingExpanded: { gap: 8 },
  feedbackInput: { backgroundColor: colors.glass, borderRadius: 12, padding: 10, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.glassBorder, minHeight: 60, textAlignVertical: 'top' },
  submitRatingBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  submitRatingText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
