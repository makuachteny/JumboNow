import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock,
  Calendar,
  Users,
  Ticket,
  CreditCard,
  CheckCircle,
  Flag,
  Edit3,
  Trash2,
  UserPlus,
  X,
  Send,
} from 'lucide-react-native';
import { eventsService } from '../services/events.service';
import { ticketsService } from '../services/tickets.service';
import { reportsService } from '../services/reports.service';
import { friendsService } from '../services/friends.service';
import { friendGroupsService } from '../services/friendGroups.service';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

// Fallback background images for events without their own image
const EVENT_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80',
  'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=800&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80',
];

function getFallbackImage(eventId) {
  // Use a simple hash of the eventId to pick a consistent image
  const hash = String(eventId).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return EVENT_FALLBACK_IMAGES[hash % EVENT_FALLBACK_IMAGES.length];
}

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [event, setEvent] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTicketType, setSelectedTicketType] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successCode, setSuccessCode] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState([]);
  const [inviteGroups, setInviteGroups] = useState([]);
  const [invitedIds, setInvitedIds] = useState(new Set());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [eventData, reservationData, { data: { user } }] = await Promise.all([
        eventsService.getEventById(eventId),
        ticketsService.getReservationForEvent(eventId),
        supabase.auth.getUser(),
      ]);
      setEvent(eventData);
      setReservation(reservationData);
      if (user && eventData && user.id === eventData.created_by) {
        setIsCreator(true);
        // Load attendees for the event creator
        setAttendeesLoading(true);
        ticketsService.getEventAttendees(eventId)
          .then((data) => setAttendees(data))
          .catch(() => setAttendees([]))
          .finally(() => setAttendeesLoading(false));
      }
    } catch (err) {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReserve = async () => {
    setReserving(true);
    try {
      const res = await ticketsService.reserveEvent(eventId);
      setReservation(res);
      Alert.alert('Reserved!', `Your confirmation code: ${res.confirmation_code}`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reserve.');
    } finally {
      setReserving(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedTicketType) return;
    setReserving(true);
    try {
      const res = await ticketsService.purchaseTicket(
        eventId,
        selectedTicketType.name,
        selectedTicketType.price,
      );
      setReservation(res);
      setSuccessCode(res.confirmation_code);
      setPaymentSuccess(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to purchase.');
    } finally {
      setReserving(false);
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    Alert.alert('Cancel Reservation', 'Are you sure you want to cancel?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await ticketsService.cancelReservation(reservation.id);
            setReservation(null);
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to cancel.');
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!event) return;
    const dateString = new Date(event.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    try {
      await Share.share({
        message: `Check out "${event.title}" on JumboNow! ${event.location} on ${dateString}`,
        title: event.title,
      });
    } catch {}
  };

  const handleReport = () => {
    if (!event) return;
    const reportLabels = ['Spam', 'Inappropriate Content', 'Harassment', 'Misinformation', 'Other'];
    const reportValues = ['spam', 'inappropriate', 'harassment', 'misinformation', 'other'];

    Alert.alert(
      'Report Event',
      'Why are you reporting this event?',
      [
        ...reportLabels.map((label, index) => ({
          text: label,
          onPress: async () => {
            try {
              await reportsService.reportContent({
                reportedType: 'event',
                reportedId: event.id,
                reason: reportValues[index],
              });
              Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to submit report.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleDeleteEvent = () => {
    if (!event) return;
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventsService.deleteEvent(event.id);
              Alert.alert('Deleted', 'Event has been deleted.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete event.');
            }
          },
        },
      ],
    );
  };

  const openInviteModal = async () => {
    setShowInviteModal(true);
    setInviteLoading(true);
    try {
      const [friendsData, groupsData] = await Promise.all([
        friendsService.getFriends(),
        friendGroupsService.getGroups().catch(() => []),
      ]);
      setInviteFriends(friendsData);
      setInviteGroups(groupsData);
    } catch {
      setInviteFriends([]);
      setInviteGroups([]);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteFriend = async (friendId) => {
    try {
      await eventsService.inviteFriendToEvent(eventId, friendId);
      setInvitedIds((prev) => new Set([...prev, friendId]));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to invite.');
    }
  };

  const handleInviteGroup = async (groupId) => {
    try {
      const results = await eventsService.inviteGroupToEvent(eventId, groupId);
      const newIds = new Set(invitedIds);
      results.forEach((r) => newIds.add(r.invitee_id));
      setInvitedIds(newIds);
      Alert.alert('Invited!', 'Group members have been invited.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to invite group.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  const isFree = event.ticket_price === 0 || event.ticket_price === null;
  const ticketTypes = event.ticket_types && event.ticket_types.length > 0 ? event.ticket_types : [];
  const spotsUsed = event.attendee_count || 0;
  const spotsTotal = event.max_capacity || 100;
  const spotsRemaining = Math.max(0, spotsTotal - spotsUsed);
  const capacityPercent = Math.min(100, (spotsUsed / spotsTotal) * 100);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardDismissMode="on-drag"
      >
        {/* Hero Section */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {/* Background: image (with fallback) */}
          <Image
            source={{ uri: event.image_url || getFallbackImage(event.id) }}
            style={styles.heroPoster}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']}
            style={styles.heroOverlay}
          />

          <View style={styles.heroNav}>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <ArrowLeft size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.heroNavRight}>
              <TouchableOpacity
                style={styles.heroButton}
                onPress={handleShare}
                accessibilityLabel="Share event"
                accessibilityRole="button"
              >
                <Share2 size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.heroSubtitle}>{event.subtitle}</Text>
          <Text style={styles.heroTitle}>{event.title}</Text>

          {/* Price badge */}
          <View style={styles.heroBadgeRow}>
            {isFree ? (
              <View style={[styles.priceBadge, styles.freeBadge]}>
                <Text style={styles.freeBadgeText}>Free</Text>
              </View>
            ) : (
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>${event.ticket_price}</Text>
              </View>
            )}
            {event.is_featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>Featured</Text>
              </View>
            )}
            {event.visibility === 'friends_only' && (
              <View style={styles.friendsOnlyBadge}>
                <Text style={styles.friendsOnlyBadgeText}>Friends Only</Text>
              </View>
            )}
          </View>
        </View>

        {/* Organizer Info */}
        <View style={styles.organizerRow}>
          <View style={styles.organizerAvatar}>
            <Text style={styles.organizerAvatarText}>{event.organizer_icon || '🐘'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.organizerName}>{event.organizer_name || 'Tufts University'}</Text>
              {event.host?.account_type && event.host.account_type !== 'student' && (
                <View style={styles.accountTypeBadge}>
                  <Text style={styles.accountTypeBadgeText}>
                    {event.host.account_type === 'club' ? 'Club' : 'Staff'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.organizerType}>{event.event_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'General'}</Text>
          </View>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={handleReport}
            accessibilityLabel="Report this event"
            accessibilityRole="button"
          >
            <Flag size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Attendees — Instagram-style, visible only to event creator */}
        {isCreator && (
          <View style={styles.attendeesSection}>
            <Text style={styles.attendeesLabel}>Signed Up</Text>

            {attendeesLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 24 }} />
            ) : attendees.length === 0 ? (
              <View style={styles.attendeesEmpty}>
                <Users size={32} color={colors.textMuted} />
                <Text style={styles.attendeesEmptyText}>No one has signed up yet</Text>
              </View>
            ) : (
              attendees.map((attendee, index) => {
                const profile = attendee.profile;
                const displayName = profile?.display_name || profile?.username || 'Unknown';
                const username = profile?.username;
                const initials = displayName.slice(0, 2).toUpperCase();
                const avatarColor = profile?.avatar_color || '#6AADE4';
                const isPaid = attendee.reservation_type === 'ticket_purchase';
                const isLast = index === attendees.length - 1;

                return (
                  <View key={attendee.id} style={[styles.attendeeRow, !isLast && styles.attendeeRowBorder]}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.attendeeAvatar} />
                    ) : (
                      <View style={[styles.attendeeAvatarFallback, { backgroundColor: avatarColor }]}>
                        <Text style={styles.attendeeInitials}>{initials}</Text>
                      </View>
                    )}
                    <View style={styles.attendeeInfo}>
                      <Text style={styles.attendeeName} numberOfLines={1}>{displayName}</Text>
                      <Text style={styles.attendeeSub} numberOfLines={1}>
                        {username ? `@${username}` : ''}{username && isPaid ? ' · ' : ''}{isPaid ? `${attendee.ticket_type} · $${attendee.price_paid}` : username ? ' · Free RSVP' : 'Free RSVP'}
                      </Text>
                    </View>
                    <Text style={styles.attendeeCode}>{attendee.confirmation_code}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Creator Actions */}
        {isCreator && (
          <View style={styles.creatorActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('CreateEvent', { editEvent: event })}
              accessibilityLabel="Edit event"
              accessibilityRole="button"
            >
              <Edit3 size={16} color={colors.accent} />
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteEvent}
              accessibilityLabel="Delete event"
              accessibilityRole="button"
            >
              <Trash2 size={16} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete Event</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Event Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Calendar size={18} color={colors.accent} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={18} color={colors.accent} />
            <Text style={styles.detailText}>{timeStr}</Text>
          </View>
          <TouchableOpacity style={styles.detailRow} onPress={() => navigation.navigate('Map', { focusLocation: event.location, _ts: Date.now() })} accessibilityLabel={`View ${event.location} on map`} accessibilityRole="button">
            <MapPin size={18} color={colors.accent} />
            <Text style={styles.detailText}>{event.location}</Text>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <View style={styles.tagsSection}>
            {event.tags.map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Capacity Bar */}
        <View style={styles.capacitySection}>
          <View style={styles.capacityHeader}>
            <Text style={styles.capacityLabel}>Capacity</Text>
            <Text style={styles.capacityCount}>{spotsUsed} / {spotsTotal}</Text>
          </View>
          <View
            style={styles.capacityBarBg}
            accessibilityLabel={`Capacity: ${spotsUsed} of ${spotsTotal} spots filled`}
            accessibilityRole="progressbar"
          >
            <View style={[styles.capacityBarFill, {
              width: `${capacityPercent}%`,
              backgroundColor: capacityPercent > 80 ? colors.error : colors.accent,
            }]} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* Invite Friends Button */}
        <TouchableOpacity
          style={styles.inviteFriendsBtn}
          onPress={openInviteModal}
          accessibilityLabel="Invite friends to event"
          accessibilityRole="button"
        >
          <UserPlus size={18} color={colors.accent} />
          <Text style={styles.inviteFriendsBtnText}>Invite Friends</Text>
        </TouchableOpacity>

        {/* Already Reserved Card */}
        {reservation && (
          <View style={styles.reservedCard}>
            <View style={styles.reservedHeader}>
              <CheckCircle size={24} color={colors.success} />
              <Text style={styles.reservedTitle}>You're Going!</Text>
            </View>
            <TouchableOpacity
              style={styles.codeCard}
              onPress={async () => {
                await Clipboard.setStringAsync(reservation.confirmation_code);
                Alert.alert('Copied!', 'Confirmation code copied to clipboard.');
              }}
              accessibilityLabel={`Confirmation code: ${reservation.confirmation_code}. Tap to copy`}
              accessibilityRole="button"
            >
              <Text style={styles.codeLabel}>Confirmation Code</Text>
              <Text style={styles.codeText}>{reservation.confirmation_code}</Text>
              <Text style={styles.codeType}>
                {reservation.reservation_type === 'free_rsvp' ? 'Free RSVP' : `${reservation.ticket_type} Ticket - $${reservation.price_paid}`}
              </Text>
              <Text style={styles.codeCopyHint}>Tap to copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityLabel="Cancel reservation"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel Reservation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ticket Selection for Paid Events */}
        {!reservation && !isFree && ticketTypes.length > 0 && (
          <View style={styles.ticketSection}>
            <Text style={styles.sectionTitle}>Select Ticket</Text>
            {ticketTypes.map((tt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.ticketOption, selectedTicketType?.name === tt.name && styles.ticketOptionSelected]}
                onPress={() => setSelectedTicketType(tt)}
                accessibilityLabel={`${tt.name} ticket, ${tt.price} dollars, ${tt.available} available`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedTicketType?.name === tt.name }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketName}>{tt.name}</Text>
                  <Text style={styles.ticketAvail}>{tt.available} available</Text>
                </View>
                <Text style={styles.ticketPrice}>${tt.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Area */}
      {!reservation && (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {isFree ? (
            <TouchableOpacity
              style={[styles.reserveButton, reserving && { opacity: 0.6 }]}
              onPress={handleReserve}
              disabled={reserving}
              accessibilityLabel="Reserve your spot"
              accessibilityRole="button"
              accessibilityState={{ disabled: reserving }}
            >
              {reserving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ticket size={20} color="#FFF" />
                  <Text style={styles.reserveButtonText}>Reserve Your Spot</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.buyButton, (!selectedTicketType || reserving) && { opacity: 0.6 }]}
              onPress={() => {
                if (selectedTicketType) setShowPaymentModal(true);
              }}
              disabled={!selectedTicketType || reserving}
              accessibilityLabel={selectedTicketType ? `Buy ticket for ${selectedTicketType.price} dollars` : 'Select a ticket first'}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedTicketType || reserving }}
            >
              <CreditCard size={20} color="#FFF" />
              <Text style={styles.buyButtonText}>
                {selectedTicketType ? `Buy Ticket - $${selectedTicketType.price}` : 'Select a Ticket'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Invite Friends Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.inviteOverlay}>
          <View style={styles.inviteContent}>
            <View style={styles.inviteHeader}>
              <Text style={styles.inviteTitle}>Invite Friends</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {inviteLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ paddingVertical: 40 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {/* Groups */}
                {inviteGroups.length > 0 && (
                  <>
                    <Text style={styles.inviteSectionLabel}>Groups</Text>
                    {inviteGroups.map((group) => (
                      <View key={group.id} style={styles.inviteRow}>
                        <View style={[styles.inviteGroupIcon, { backgroundColor: (group.color || '#6AADE4') + '20' }]}>
                          <Text style={{ fontSize: 18 }}>{group.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inviteRowName}>{group.name}</Text>
                          <Text style={styles.inviteRowSub}>{group.members?.length || 0} members</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.inviteAllBtn}
                          onPress={() => handleInviteGroup(group.id)}
                        >
                          <Send size={14} color={colors.accent} />
                          <Text style={styles.inviteAllBtnText}>Invite All</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}

                {/* Individual Friends */}
                {inviteFriends.length > 0 && (
                  <>
                    <Text style={styles.inviteSectionLabel}>Friends</Text>
                    {inviteFriends.map((friend) => {
                      const invited = invitedIds.has(friend.id);
                      return (
                        <View key={friend.id} style={styles.inviteRow}>
                          <View style={[styles.inviteFriendAvatar, { backgroundColor: friend.avatar_color || '#6AADE4' }]}>
                            <Text style={styles.inviteFriendAvatarText}>
                              {(friend.display_name || friend.username || '?').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inviteRowName}>{friend.display_name || friend.username}</Text>
                            <Text style={styles.inviteRowSub}>@{friend.username}</Text>
                          </View>
                          {invited ? (
                            <View style={styles.invitedBadge}>
                              <CheckCircle size={14} color={colors.success} />
                              <Text style={styles.invitedBadgeText}>Invited</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.inviteBtn}
                              onPress={() => handleInviteFriend(friend.id)}
                            >
                              <Text style={styles.inviteBtnText}>Invite</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                {inviteFriends.length === 0 && inviteGroups.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Users size={40} color={colors.accentMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>No friends yet. Add some first!</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Mock Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent onRequestClose={() => { setShowPaymentModal(false); setPaymentSuccess(false); }}>
        <View style={styles.paymentOverlay}>
          <View style={styles.paymentContent}>
            {paymentSuccess ? (
              <View style={styles.successContent}>
                <View style={styles.successIcon}>
                  <CheckCircle size={48} color={colors.success} />
                </View>
                <Text style={styles.successTitle}>Purchase Successful!</Text>
                <Text style={styles.successSubtitle}>Your ticket has been confirmed</Text>
                <TouchableOpacity
                  style={styles.successCodeCard}
                  onPress={async () => {
                    await Clipboard.setStringAsync(successCode);
                    Alert.alert('Copied!', 'Confirmation code copied to clipboard.');
                  }}
                  accessibilityLabel={`Confirmation code: ${successCode}. Tap to copy`}
                  accessibilityRole="button"
                >
                  <Text style={styles.successCodeLabel}>Confirmation Code</Text>
                  <Text style={styles.successCodeText}>{successCode}</Text>
                  <Text style={styles.codeCopyHint}>Tap to copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.successDoneButton}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setPaymentSuccess(false);
                  }}
                  accessibilityLabel="Done"
                  accessibilityRole="button"
                >
                  <Text style={styles.successDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentTitle}>Confirm Purchase</Text>
                  <TouchableOpacity
                    onPress={() => setShowPaymentModal(false)}
                    accessibilityLabel="Close payment modal"
                    accessibilityRole="button"
                  >
                    <Text style={{ color: colors.accent, fontSize: 18 }}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentEventTitle}>{event.title}</Text>
                  <Text style={styles.paymentTicketInfo}>
                    {selectedTicketType?.name} Ticket
                  </Text>
                  <View style={styles.paymentDivider} />
                  <View style={styles.paymentTotalRow}>
                    <Text style={styles.paymentTotalLabel}>Total</Text>
                    <Text style={styles.paymentTotalAmount}>${selectedTicketType?.price}</Text>
                  </View>
                </View>

                {/* Mock Card UI */}
                <View style={styles.mockCard}>
                  <View style={styles.mockCardHeader}>
                    <CreditCard size={20} color="#FFF" />
                    <Text style={styles.mockCardTitle}>Demo Card</Text>
                  </View>
                  <Text style={styles.mockCardNumber}>{'\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  4242'}</Text>
                  <View style={styles.mockCardFooter}>
                    <Text style={styles.mockCardName}>TUFTS STUDENT</Text>
                    <Text style={styles.mockCardExpiry}>12/28</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.confirmPurchaseButton, reserving && { opacity: 0.6 }]}
                  onPress={handlePurchase}
                  disabled={reserving}
                  accessibilityLabel="Confirm purchase"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: reserving }}
                >
                  {reserving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.confirmPurchaseText}>Confirm Purchase</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.mockDisclaimer}>This is a demo. No real payment is processed.</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  errorText: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  backLink: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.buttonPrimary },
  backLinkText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  hero: { paddingHorizontal: 24, paddingBottom: 28, minHeight: 340 },
  heroPoster: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, zIndex: 1 },
  heroNavRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', marginBottom: 12 },
  heroBadgeRow: { flexDirection: 'row', gap: 8 },
  priceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  freeBadge: { backgroundColor: 'rgba(34,197,94,0.3)' },
  freeBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  priceBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  featuredBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(250,204,21,0.3)' },
  featuredBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  friendsOnlyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.3)' },
  friendsOnlyBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  accountTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  accountTypeBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginHorizontal: 16, marginTop: -16, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  organizerAvatar: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center' },
  organizerAvatarText: { fontSize: 22 },
  organizerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  organizerType: { color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginTop: 2 },
  reportButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  creatorActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  editButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  editButtonText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  deleteButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.error + '10', borderWidth: 1, borderColor: colors.error + '40' },
  deleteButtonText: { color: colors.error, fontSize: 14, fontWeight: '700' },
  attendeesSection: { marginHorizontal: 16, marginTop: 12 },
  attendeesLabel: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8, paddingHorizontal: 2 },
  attendeesEmpty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  attendeesEmptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  attendeeRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassBorder },
  attendeeAvatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  attendeeAvatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  attendeeInitials: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  attendeeInfo: { flex: 1 },
  attendeeName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  attendeeSub: { color: colors.textTertiary, fontSize: 13, fontWeight: '400', marginTop: 1 },
  attendeeCode: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  detailsSection: { padding: 16, gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  tagsSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  tagText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  capacitySection: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  capacityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  capacityLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: '600' },
  capacityCount: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  capacityBarBg: { height: 8, backgroundColor: colors.inputBg, borderRadius: 4, overflow: 'hidden' },
  capacityBarFill: { height: '100%', borderRadius: 4 },
  descriptionSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  reservedCard: { marginHorizontal: 16, marginBottom: 16, padding: 20, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  reservedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  reservedTitle: { color: colors.success, fontSize: 20, fontWeight: '900' },
  codeCard: { alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: colors.accentBg, marginBottom: 16 },
  codeLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  codeText: { color: colors.accent, fontSize: 28, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  codeType: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },
  codeCopyHint: { color: colors.accentMuted, fontSize: 11, fontWeight: '600', marginTop: 6 },
  cancelButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.error + '40', backgroundColor: colors.error + '10' },
  cancelButtonText: { color: colors.error, fontSize: 14, fontWeight: '700' },
  ticketSection: { paddingHorizontal: 16, marginBottom: 16 },
  ticketOption: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 8, borderRadius: 14, backgroundColor: colors.glass, borderWidth: 2, borderColor: colors.glassBorder },
  ticketOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  ticketName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ticketAvail: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  ticketPrice: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: colors.glassBorder },
  reserveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.success },
  reserveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  buyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.buttonPrimary },
  buyButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  paymentOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  paymentContent: { backgroundColor: colors.modalBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.cardBorder },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  paymentTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  paymentSummary: { padding: 16, borderRadius: 14, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, marginBottom: 20 },
  paymentEventTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  paymentTicketInfo: { color: colors.textTertiary, fontSize: 13, marginBottom: 12 },
  paymentDivider: { height: 1, backgroundColor: colors.divider, marginBottom: 12 },
  paymentTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentTotalLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  paymentTotalAmount: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  mockCard: { padding: 20, borderRadius: 14, backgroundColor: '#1E293B', marginBottom: 20, gap: 12 },
  mockCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mockCardTitle: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  mockCardNumber: { color: '#FFF', fontSize: 18, fontWeight: '600', letterSpacing: 2 },
  mockCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  mockCardName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  mockCardExpiry: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  confirmPurchaseButton: { alignItems: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: colors.buttonPrimary, marginBottom: 12 },
  confirmPurchaseText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  mockDisclaimer: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  successContent: { alignItems: 'center', paddingVertical: 20 },
  successIcon: { marginBottom: 16 },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 6 },
  successSubtitle: { color: colors.textTertiary, fontSize: 14, marginBottom: 24 },
  successCodeCard: { alignItems: 'center', padding: 20, borderRadius: 16, backgroundColor: colors.accentBg, marginBottom: 24, width: '100%' },
  successCodeLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  successCodeText: { color: colors.accent, fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  successDoneButton: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 16, backgroundColor: colors.buttonPrimary },
  successDoneText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  inviteFriendsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  inviteFriendsBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  inviteOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  inviteContent: { backgroundColor: colors.modalBg || colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%', borderWidth: 1, borderColor: colors.cardBorder },
  inviteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  inviteTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  inviteSectionLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  inviteGroupIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inviteFriendAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inviteFriendAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  inviteRowName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  inviteRowSub: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  inviteAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  inviteAllBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  inviteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.buttonPrimary },
  inviteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  invitedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.1)' },
  invitedBadgeText: { color: colors.success, fontSize: 12, fontWeight: '700' },
});
