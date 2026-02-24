import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Share2,
  MessageCircle,
  Search,
  Calendar,
  MapPin,
  X,
} from 'lucide-react-native';
import { chatService } from '../services/chat.service';
import { friendsService } from '../services/friends.service';
import { eventsService } from '../services/events.service';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------
function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return days[date.getDay()];

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes < 10 ? `0${minutes}` : minutes;
  return `${h}:${m} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Auth
  const [currentUserId, setCurrentUserId] = useState(null);

  // Conversation list state
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active chat state
  const [activeConversation, setActiveConversation] = useState(null); // { id, otherUser }
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Event share state
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);
  const convSubscriptionRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Get current user ID on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-open conversation if navigated with friendId
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (route.params?.friendId && currentUserId && !activeConversation) {
      // Find friend profile from friends list or create minimal object
      const friendId = route.params.friendId;
      const friend = friends.find((f) => f.id === friendId);
      if (friend) {
        openConversation(friend);
      } else {
        // Open with just the id — openConversation will fetch or create
        openConversation({ id: friendId });
      }
    }
  }, [route.params?.friendId, currentUserId, friends]);

  // ---------------------------------------------------------------------------
  // Fetch conversations + friends
  // ---------------------------------------------------------------------------
  const fetchConversations = useCallback(async () => {
    try {
      setListError(null);
      const [convData, friendsData] = await Promise.all([
        chatService.getConversations(),
        friendsService.getFriends(),
      ]);
      setConversations(convData);
      setFriends(friendsData);
    } catch (err) {
      setListError('Failed to load messages. Pull down to retry.');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    // Subscribe to conversation updates
    const sub = chatService.subscribeToConversations(() => {
      fetchConversations();
    });
    convSubscriptionRef.current = sub;

    return () => {
      convSubscriptionRef.current?.unsubscribe();
    };
  }, [fetchConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  // ---------------------------------------------------------------------------
  // Open a conversation
  // ---------------------------------------------------------------------------
  const openConversation = useCallback(
    async (otherUser) => {
      try {
        setLoadingMessages(true);
        setChatError(null);
        const conversationId = await chatService.getOrCreateConversation(otherUser.id);
        const msgs = await chatService.getMessages(conversationId);
        setMessages(msgs);
        setActiveConversation({ id: conversationId, otherUser });

        // Mark messages as read
        chatService.markMessagesRead(conversationId).catch(() => {});

        // Subscribe to new messages
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        const sub = chatService.subscribeToMessages(conversationId, async (payload) => {
          const newMsg = payload.new;
          if (newMsg) {
            // Fetch the full message with sender profile
            const freshMessages = await chatService.getMessages(conversationId);
            setMessages(freshMessages);
            chatService.markMessagesRead(conversationId).catch(() => {});
          }
        });
        subscriptionRef.current = sub;
      } catch (err) {
        setChatError('Failed to load conversation. Please try again.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  const closeConversation = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    // If opened from FriendsScreen with a friendId, go back instead of showing convo list
    if (route.params?.friendId) {
      navigation.goBack();
      return;
    }
    setActiveConversation(null);
    setMessages([]);
    setMessageText('');
    setChatError(null);
    // Refresh conversation list to reflect read status / new messages
    fetchConversations();
  }, [fetchConversations, route.params?.friendId, navigation]);

  // ---------------------------------------------------------------------------
  // Send a message
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    if (!messageText.trim() || sending || !activeConversation) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const sentMsg = await chatService.sendMessage(activeConversation.id, text);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      setChatError(err.message || 'Failed to send message.');
      setMessageText(text); // Restore text so user can retry
    } finally {
      setSending(false);
    }
  }, [messageText, sending, activeConversation]);

  // ---------------------------------------------------------------------------
  // Event share handlers
  // ---------------------------------------------------------------------------
  const openEventPicker = useCallback(async () => {
    setShowEventPicker(true);
    setEventsLoading(true);
    try {
      const data = await eventsService.getEvents();
      setEvents((data || []).slice(0, 20));
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const handleShareEvent = useCallback(async (event) => {
    if (!activeConversation) return;
    setShowEventPicker(false);
    setSending(true);
    try {
      const metadata = {
        type: 'event_share',
        event_id: event.id,
        event_title: event.title,
        event_date: event.start_time,
        event_location: event.location || '',
        event_icon: event.icon || '\uD83C\uDF89',
      };
      const sentMsg = await chatService.sendMessage(activeConversation.id, '', metadata);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      setChatError(err.message || 'Failed to share event.');
    } finally {
      setSending(false);
    }
  }, [activeConversation]);

  // ---------------------------------------------------------------------------
  // Filter conversations by search
  // ---------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const name = (conv.otherUser?.display_name || conv.otherUser?.username || '').toLowerCase();
      return name.includes(q);
    });
  }, [conversations, searchQuery]);

  // Friends who don't have an existing conversation yet (for the online bar)
  const onlineFriends = useMemo(() => {
    return friends.slice(0, 15);
  }, [friends]);

  // ---------------------------------------------------------------------------
  // Render: Active Chat View
  // ---------------------------------------------------------------------------
  if (activeConversation) {
    const { otherUser } = activeConversation;
    const displayName = otherUser.display_name || otherUser.username || 'User';
    const avatarInitials = (displayName).slice(0, 1).toUpperCase();
    const avatarColor = otherUser.avatar_color || colors.accent;

    const renderMessage = ({ item }) => {
      const isMine = item.sender_id === currentUserId;

      // Event share card
      if (item.metadata?.type === 'event_share') {
        const meta = item.metadata;
        const eventDate = meta.event_date
          ? new Date(meta.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '';
        return (
          <View style={[styles.messageBubbleRow, isMine ? styles.messageBubbleRowRight : styles.messageBubbleRowLeft]}>
            {!isMine && (
              <View style={[styles.msgAvatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.msgAvatarText}>{avatarInitials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.eventShareCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EventDetail', { eventId: meta.event_id })}
            >
              <View style={styles.eventShareHeader}>
                <View style={styles.eventShareIconWrap}>
                  <Text style={styles.eventShareIcon}>{meta.event_icon || '\uD83C\uDF89'}</Text>
                </View>
                <View style={styles.eventShareInfo}>
                  <Text style={styles.eventShareTitle} numberOfLines={2}>{meta.event_title}</Text>
                  {eventDate ? <Text style={styles.eventShareDate}>{eventDate}</Text> : null}
                  {meta.event_location ? <Text style={styles.eventShareLocation} numberOfLines={1}>{meta.event_location}</Text> : null}
                </View>
              </View>
              <View style={styles.viewEventBtn}>
                <Text style={styles.viewEventBtnText}>View Event</Text>
              </View>
              <Text style={[styles.messageTime, isMine ? styles.messageTimeSent : styles.messageTimeReceived]}>
                {formatMessageTime(item.created_at)}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View
          style={[
            styles.messageBubbleRow,
            isMine ? styles.messageBubbleRowRight : styles.messageBubbleRowLeft,
          ]}
        >
          {!isMine && (
            <View style={[styles.msgAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.msgAvatarText}>{avatarInitials}</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMine ? styles.messageBubbleSent : styles.messageBubbleReceived,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMine ? styles.messageTextSent : styles.messageTextReceived,
              ]}
            >
              {item.text}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.messageTimeSent : styles.messageTimeReceived,
              ]}
            >
              {formatMessageTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    };

    return (
      <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={colors.statusBarStyle} />

        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.backButton} onPress={closeConversation}>
            <ArrowLeft size={22} color={colors.accent} />
          </TouchableOpacity>
          <View style={[styles.chatHeaderAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.chatHeaderAvatarText}>{avatarInitials}</Text>
          </View>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.chatHeaderStatus}>
              @{otherUser.username || 'user'}
            </Text>
          </View>
        </View>

        {/* Chat Error */}
        {chatError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{chatError}</Text>
            <TouchableOpacity onPress={() => setChatError(null)}>
              <Text style={styles.errorDismiss}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.chatBody}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 60}
        >
          {/* Messages List */}
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              inverted={false}
              contentContainerStyle={[
                styles.messagesList,
                messages.length === 0 && styles.messagesListEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              onLayout={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <View style={styles.emptyChatIconWrap}>
                    <MessageCircle size={40} color={colors.accentMuted} />
                  </View>
                  <Text style={styles.emptyChatTitle}>No messages yet</Text>
                  <Text style={styles.emptyChatSubtext}>
                    Say hi to {displayName}!
                  </Text>
                </View>
              }
            />
          )}

          {/* Input Bar */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity style={styles.shareButton} onPress={openEventPicker}>
              <Share2 size={18} color={colors.accent} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.accentMuted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Send size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Event Picker Modal */}
        <Modal visible={showEventPicker} animationType="slide" transparent onRequestClose={() => setShowEventPicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Share an Event</Text>
                <TouchableOpacity onPress={() => setShowEventPicker(false)}>
                  <X size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {eventsLoading ? (
                <ActivityIndicator size="large" color={colors.accent} style={{ paddingVertical: 40 }} />
              ) : (
                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                  {events.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Calendar size={40} color={colors.accentMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>No upcoming events</Text>
                    </View>
                  ) : (
                    events.map((event) => (
                      <TouchableOpacity
                        key={event.id}
                        style={styles.eventPickerItem}
                        onPress={() => handleShareEvent(event)}
                      >
                        <Text style={styles.eventPickerIcon}>{event.icon || '\uD83C\uDF89'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventPickerTitle} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.eventPickerMeta} numberOfLines={1}>
                            {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {event.location ? ` \u2022 ${event.location}` : ''}
                          </Text>
                        </View>
                        <Send size={16} color={colors.accent} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Conversation List View
  // ---------------------------------------------------------------------------
  const renderConversation = ({ item }) => {
    const { otherUser } = item;
    const displayName = otherUser?.display_name || otherUser?.username || 'User';
    const initials = displayName.slice(0, 2).toUpperCase();
    const avatarColor = otherUser?.avatar_color || colors.accent;

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        activeOpacity={0.7}
        onPress={() => openConversation(otherUser)}
      >
        <View style={[styles.convAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.convAvatarText}>{initials}</Text>
        </View>
        <View style={styles.convContent}>
          <View style={styles.convTopRow}>
            <Text style={styles.convName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.convTime}>{formatTimestamp(item.lastMessageAt)}</Text>
          </View>
          <Text style={styles.convPreview} numberOfLines={1}>
            {item.lastMessage || 'Tap to start chatting...'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOnlineFriend = ({ item }) => {
    const displayName = item.display_name || item.username || 'User';
    const initial = displayName.slice(0, 1).toUpperCase();
    const avatarColor = item.avatar_color || colors.accent;

    return (
      <TouchableOpacity
        style={styles.onlineItem}
        onPress={() => openConversation(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.onlineAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.onlineAvatarText}>{initial}</Text>
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.onlineName} numberOfLines={1}>
          {displayName.split(' ')[0]}
        </Text>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.accentMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor={colors.accentMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: colors.accent, fontSize: 16 }}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Online Friends Bar */}
      {onlineFriends.length > 0 && (
        <FlatList
          data={onlineFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderOnlineFriend}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.onlineBar}
        />
      )}

      {/* Section Label */}
      {filteredConversations.length > 0 && (
        <Text style={styles.sectionLabel}>Messages</Text>
      )}
    </>
  );

  return (
    <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Error State */}
      {listError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{listError}</Text>
          <TouchableOpacity onPress={() => setListError(null)}>
            <Text style={styles.errorDismiss}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {loadingConversations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 90 },
            filteredConversations.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MessageCircle size={48} color={colors.accentMuted} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start a conversation with your friends to plan events and hang out!
              </Text>
            </View>
          }
        />
      )}

    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },

    // ---- Header ----
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.glassBorder,
    },
    backButton: {
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
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },

    // ---- Error Banner ----
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    errorDismiss: {
      color: colors.error,
      fontSize: 16,
      marginLeft: 10,
    },

    // ---- Search ----
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },

    // ---- Online Friends Bar ----
    onlineBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 16,
    },
    onlineItem: {
      alignItems: 'center',
      width: 60,
    },
    onlineAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    onlineAvatarText: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: '800',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.success,
      borderWidth: 2.5,
      borderColor: colors.background,
    },
    onlineName: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 5,
      textAlign: 'center',
    },

    // ---- Conversation List ----
    listContent: {
      paddingBottom: 90,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    sectionLabel: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
      marginHorizontal: 16,
    },
    conversationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginHorizontal: 16,
      marginBottom: 6,
      borderRadius: 16,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    convAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    convAvatarText: {
      color: '#FFF',
      fontSize: 17,
      fontWeight: '800',
    },
    convContent: {
      flex: 1,
      gap: 4,
    },
    convTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    convName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      flex: 1,
      marginRight: 8,
    },
    convTime: {
      color: colors.accentMuted,
      fontSize: 11,
      fontWeight: '500',
    },
    convPreview: {
      color: colors.textMuted,
      fontSize: 13,
    },

    // ---- Empty State ----
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      paddingHorizontal: 40,
      gap: 14,
    },
    emptyIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
    },

    // ---- Loading ----
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ---- Chat Header ----
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.glassBorder,
    },
    chatHeaderAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatHeaderAvatarText: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '800',
    },
    chatHeaderInfo: {
      flex: 1,
    },
    chatHeaderName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    chatHeaderStatus: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },

    // ---- Chat Body ----
    chatBody: {
      flex: 1,
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    messagesListEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },

    // ---- Message Bubbles ----
    messageBubbleRow: {
      flexDirection: 'row',
      marginBottom: 8,
      alignItems: 'flex-end',
    },
    messageBubbleRowLeft: {
      justifyContent: 'flex-start',
    },
    messageBubbleRowRight: {
      justifyContent: 'flex-end',
    },
    msgAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    msgAvatarText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '800',
    },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    messageBubbleSent: {
      backgroundColor: colors.buttonPrimary,
      borderBottomRightRadius: 4,
    },
    messageBubbleReceived: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 21,
    },
    messageTextSent: {
      color: '#FFFFFF',
    },
    messageTextReceived: {
      color: colors.text,
    },
    messageTime: {
      fontSize: 10,
      fontWeight: '500',
      marginTop: 4,
    },
    messageTimeSent: {
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'right',
    },
    messageTimeReceived: {
      color: colors.accentMuted,
    },

    // ---- Empty Chat ----
    emptyChat: {
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyChatIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyChatTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    emptyChatSubtext: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },

    // ---- Input Bar ----
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.glassBorder,
      backgroundColor: 'transparent',
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      color: colors.text,
      fontSize: 15,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    shareButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },

    // Event share card
    eventShareCard: {
      width: 260,
      maxWidth: '85%',
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    eventShareHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 10,
    },
    eventShareIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventShareIcon: { fontSize: 24 },
    eventShareInfo: { flex: 1 },
    eventShareTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
    eventShareDate: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 3 },
    eventShareLocation: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
    viewEventBtn: {
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      marginBottom: 4,
    },
    viewEventBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

    // Event picker modal
    pickerOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    pickerContent: {
      backgroundColor: colors.modalBg || colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    pickerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
    eventPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    eventPickerIcon: { fontSize: 28 },
    eventPickerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    eventPickerMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  });
