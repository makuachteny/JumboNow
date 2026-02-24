import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Users,
  Plus,
  Trash2,
  ChevronRight,
  X,
  Link2,
  ArrowLeft,
} from 'lucide-react-native';
import { friendsService } from '../services/friends.service';
import { friendGroupsService } from '../services/friendGroups.service';
import { chatService } from '../services/chat.service';
import { groupChatService } from '../services/groupChat.service';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

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

export default function FriendsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [viewMode, setViewMode] = useState('messages'); // 'messages' | 'add'
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [groupConversations, setGroupConversations] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [addActiveTab, setAddActiveTab] = useState('requests'); // 'requests' | 'discover'
  const fadeIn = useRef(new Animated.Value(0)).current;

  const mapProfile = (p) => ({
    ...p,
    name: p.display_name || p.username,
    avatar: (p.display_name || p.username || 'AN').slice(0, 2).toUpperCase(),
    avatarColor: p.avatar_color || '#418FDE',
    year: p.graduation_year ? `'${p.graduation_year.slice(-2)}` : '',
    verified: p.is_verified || false,
    mutualFriends: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [friendsData, convData, groupConvData, requestsData, suggestedData] = await Promise.all([
        friendsService.getFriends(),
        chatService.getConversations(),
        groupChatService.getGroupConversations().catch(() => []),
        friendsService.getFriendRequests(),
        friendsService.getSuggestedFriends(),
      ]);
      setFriends(friendsData.map(mapProfile));
      setConversations(convData);
      setGroupConversations(groupConvData);
      setRequests(requestsData.map((r) => ({ ...mapProfile(r), request_id: r.request_id })));
      setSuggested(suggestedData.map(mapProfile));
    } catch (err) {
      setError('Failed to load. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const friendSub = friendsService.subscribeFriendships(() => fetchData());
    const convSub = chatService.subscribeToConversations(() => fetchData());
    const groupConvSub = groupChatService.subscribeToGroupConversations(() => fetchData());

    return () => {
      friendSub?.unsubscribe();
      convSub?.unsubscribe();
      groupConvSub?.unsubscribe();
    };
  }, [fetchData]);

  // Fetch all non-friend users when Discover tab is active
  useEffect(() => {
    if (viewMode !== 'add' || addActiveTab !== 'discover') return;
    let cancelled = false;
    const fetchDiscover = async () => {
      setDiscoverLoading(true);
      try {
        const results = await friendsService.discoverUsers();
        if (!cancelled) setDiscoverUsers(results.map(mapProfile));
      } catch {
        if (!cancelled) setDiscoverUsers([]);
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    };
    fetchDiscover();
    return () => { cancelled = true; };
  }, [viewMode, addActiveTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Unified chat list: active chats on top, then friends without convos, then groups
  const unifiedChatList = useMemo(() => {
    const q = searchQuery.toLowerCase();

    const dmFriendIds = new Set();
    const dms = conversations.map((c) => {
      if (c.otherUser?.id) dmFriendIds.add(c.otherUser.id);
      return {
        type: 'dm',
        id: c.id,
        name: c.otherUser?.display_name || c.otherUser?.username || 'User',
        initials: (c.otherUser?.display_name || c.otherUser?.username || 'U').slice(0, 2).toUpperCase(),
        avatarColor: c.otherUser?.avatar_color || '#418FDE',
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        otherUser: c.otherUser,
      };
    });

    // Friends without a conversation yet
    const friendDms = friends
      .filter((f) => !dmFriendIds.has(f.id))
      .map((f) => ({
        type: 'dm',
        id: `friend-${f.id}`,
        name: f.display_name || f.username || 'User',
        initials: (f.display_name || f.username || 'U').slice(0, 2).toUpperCase(),
        avatarColor: f.avatar_color || '#418FDE',
        lastMessage: 'Tap to start chatting',
        lastMessageAt: null,
        otherUser: f,
      }));

    const grps = groupConversations.map((g) => ({
      type: 'group',
      id: g.id,
      groupId: g.groupId,
      name: g.name,
      icon: g.icon,
      color: g.color,
      memberCount: g.memberCount,
      lastMessage: g.lastMessage,
      lastMessageAt: g.lastMessageAt,
    }));

    // Active chats first (by time), then no-convo friends (alphabetical)
    let combined = [...dms, ...grps, ...friendDms].sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      if (a.lastMessageAt && !b.lastMessageAt) return -1;
      if (!a.lastMessageAt && b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });

    if (q && viewMode === 'messages') {
      combined = combined.filter((c) => c.name.toLowerCase().includes(q));
    }
    return combined;
  }, [conversations, groupConversations, friends, searchQuery, viewMode]);

  const handleAddFriend = async (user) => {
    try {
      await friendsService.sendFriendRequest(user.id);
      setSuggested(suggested.filter((s) => s.id !== user.id));
      setSearchResults(searchResults.filter((s) => s.id !== user.id));
      setDiscoverUsers(discoverUsers.filter((s) => s.id !== user.id));
      Alert.alert('Request Sent', `Friend request sent to ${user.name}!`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send request.');
    }
  };

  const handleAcceptRequest = async (user) => {
    try {
      await friendsService.acceptRequest(user.request_id);
      setRequests(requests.filter((r) => r.id !== user.id));
      fetchData();
      Alert.alert('Friend Added', `You and ${user.name} are now friends!`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to accept request.');
    }
  };

  const handleDeclineRequest = async (user) => {
    try {
      await friendsService.declineRequest(user.request_id);
      setRequests(requests.filter((r) => r.id !== user.id));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to decline request.');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const group = await friendGroupsService.createGroup(newGroupName.trim());
      if (selectedMembers.length > 0) {
        await friendGroupsService.addMultipleMembers(group.id, selectedMembers);
      }
      setShowCreateGroup(false);
      setNewGroupName('');
      setSelectedMembers([]);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group.');
    }
  };

  const handleInviteLink = async () => {
    try {
      await Share.share({
        message: 'Join me on JumboNow! Connect with Tufts students and discover campus events. https://jumbonow.app',
      });
    } catch {}
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const filteredDiscoverUsers = useMemo(() => {
    if (!searchQuery.trim()) return discoverUsers;
    const q = searchQuery.toLowerCase();
    return discoverUsers.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q),
    );
  }, [discoverUsers, searchQuery]);

  const renderChatItem = ({ item }) => {
    if (item.type === 'dm') {
      return (
        <TouchableOpacity
          style={styles.chatCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Chat', { friendId: item.otherUser?.id })}
        >
          <View style={[styles.chatAvatar, { backgroundColor: item.avatarColor }]}>
            <Text style={styles.chatAvatarText}>{item.initials}</Text>
          </View>
          <View style={styles.chatContent}>
            <View style={styles.chatTopRow}>
              <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.chatTime}>{formatTimestamp(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {item.lastMessage || 'Tap to start chatting...'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Group
    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('GroupChat', {
          groupConversationId: item.id,
          groupId: item.groupId,
          groupName: item.name,
          groupIcon: item.icon,
          groupColor: item.color,
          memberCount: item.memberCount,
        })}
      >
        <View style={[styles.groupAvatarSquare, { backgroundColor: (item.color || '#418FDE') + '20' }]}>
          <Text style={styles.groupAvatarIcon}>{item.icon || '\uD83D\uDC65'}</Text>
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.name} <Text style={styles.memberCountLabel}>({item.memberCount})</Text>
            </Text>
            <Text style={styles.chatTime}>{formatTimestamp(item.lastMessageAt)}</Text>
          </View>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>friends</Text>
        {viewMode === 'messages' ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { setViewMode('add'); setSearchQuery(''); }}
            accessibilityLabel="Add friends"
            accessibilityRole="button"
          >
            <UserPlus size={16} color={colors.text} strokeWidth={2.5} />
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { setViewMode('messages'); setSearchQuery(''); }}
            accessibilityLabel="Done adding friends"
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>DONE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.accentMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={viewMode === 'messages' ? 'Search chats' : 'Search for friends'}
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

      {/* ===== MESSAGES VIEW ===== */}
      {viewMode === 'messages' && (
        <>
          {/* Create Group button */}
          <TouchableOpacity
            style={styles.createGroupBtn}
            onPress={() => setShowCreateGroup(true)}
          >
            <View style={styles.createGroupIcon}>
              <Plus size={22} color={colors.accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.createGroupText}>Create Group</Text>
          </TouchableOpacity>

          <FlatList
            data={unifiedChatList}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderChatItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 90 },
              unifiedChatList.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={colors.accent} />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Users size={40} color={colors.accentMuted} />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySubtext}>Add friends to start chatting!</Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => { setViewMode('add'); setSearchQuery(''); }}
                  >
                    <Text style={styles.emptyActionBtnText}>Find Friends</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
        </>
      )}

      {/* ===== ADD VIEW ===== */}
      {viewMode === 'add' && (
        <>
          {/* Sub-tabs: Requests | Discover */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, addActiveTab === 'requests' && styles.tabActive]}
              onPress={() => setAddActiveTab('requests')}
            >
              <Text style={[styles.tabText, addActiveTab === 'requests' && styles.tabTextActive]}>Requests</Text>
              {requests.length > 0 && (
                <View style={[styles.tabBadge, addActiveTab === 'requests' && styles.tabBadgeActive]}>
                  <Text style={styles.tabBadgeText}>{requests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, addActiveTab === 'discover' && styles.tabActive]}
              onPress={() => setAddActiveTab('discover')}
            >
              <Text style={[styles.tabText, addActiveTab === 'discover' && styles.tabTextActive]}>Discover</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
          >
            <Animated.View style={{ opacity: fadeIn }}>
              {/* REQUESTS TAB */}
              {addActiveTab === 'requests' && (
                <View style={styles.listSection}>
                  {/* Invite Friend Link */}
                  <TouchableOpacity style={styles.inviteRow} onPress={handleInviteLink}>
                    <View style={styles.inviteDashedCircle}>
                      <Link2 size={20} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inviteTitle}>Invite friend</Text>
                      <Text style={styles.inviteSubtext}>Get your friends on JumboNow</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  {requests.length === 0 ? (
                    <View style={styles.emptyState}>
                      <UserPlus size={40} color={colors.accentMuted} />
                      <Text style={styles.emptyTitle}>No pending requests</Text>
                      <Text style={styles.emptySubtext}>When someone sends you a request, it'll show up here.</Text>
                    </View>
                  ) : (
                    requests.map((request) => (
                      <View key={request.id} style={styles.requestCard}>
                        <View style={[styles.friendAvatar, { backgroundColor: request.avatarColor }]}>
                          <Text style={styles.friendAvatarText}>{request.avatar}</Text>
                        </View>
                        <View style={styles.friendInfo}>
                          <View style={styles.friendNameRow}>
                            <Text style={styles.friendName}>{request.name}</Text>
                            {request.verified && (
                              <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>{'\u2713'}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.friendUsername}>@{request.username}</Text>
                          {request.bio ? <Text style={styles.friendBio}>{request.bio}</Text> : null}
                          <View style={styles.requestActions}>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRequest(request)}>
                              <UserCheck size={16} color={colors.text} />
                              <Text style={styles.acceptBtnText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineRequest(request)}>
                              <UserX size={16} color={colors.error} />
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* DISCOVER TAB */}
              {addActiveTab === 'discover' && (
                <View style={styles.listSection}>
                  {discoverLoading ? (
                    <View style={styles.emptyState}>
                      <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                  ) : filteredDiscoverUsers.length > 0 ? (
                    <>
                      <Text style={styles.discoverLabel}>
                        {searchQuery.trim() ? 'RESULTS' : 'PEOPLE ON JUMBONOW'}
                      </Text>
                      {filteredDiscoverUsers.map((person) => (
                        <View key={person.id} style={styles.friendCard}>
                          <View style={[styles.friendAvatar, { backgroundColor: person.avatarColor }]}>
                            <Text style={styles.friendAvatarText}>{person.avatar}</Text>
                          </View>
                          <View style={styles.friendInfo}>
                            <View style={styles.friendNameRow}>
                              <Text style={styles.friendName}>{person.name}</Text>
                              {person.verified && (
                                <View style={styles.verifiedBadge}>
                                  <Text style={styles.verifiedText}>{'\u2713'}</Text>
                                </View>
                              )}
                              <Text style={styles.friendYear}>{person.year}</Text>
                            </View>
                            <Text style={styles.friendUsername}>@{person.username}</Text>
                          </View>
                          <TouchableOpacity style={styles.addFriendBtn} onPress={() => handleAddFriend(person)}>
                            <Text style={styles.addFriendBtnText}>ADD</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  ) : (
                    <View style={styles.emptyState}>
                      <Users size={40} color={colors.accentMuted} />
                      <Text style={styles.emptyTitle}>
                        {searchQuery.trim() ? 'No users found' : 'No new people to discover'}
                      </Text>
                      <Text style={styles.emptySubtext}>
                        {searchQuery.trim() ? 'Try a different name or username' : "You've connected with everyone on JumboNow!"}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </>
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreateGroup} animationType="slide" transparent onRequestClose={() => setShowCreateGroup(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <TouchableOpacity onPress={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedMembers([]); }}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Group name"
              placeholderTextColor={colors.accentMuted}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={styles.modalSectionLabel}>Add Friends</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {friends.map((friend) => {
                const isSelected = selectedMembers.includes(friend.id);
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={[styles.modalFriendRow, isSelected && styles.modalFriendRowSelected]}
                    onPress={() => toggleMemberSelection(friend.id)}
                  >
                    <View style={[styles.smallAvatar, { backgroundColor: friend.avatarColor }]}>
                      <Text style={styles.smallAvatarText}>{friend.avatar}</Text>
                    </View>
                    <Text style={styles.modalFriendName}>{friend.name}</Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCreateBtn, !newGroupName.trim() && { opacity: 0.5 }]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.modalCreateBtnText}>
                Create{selectedMembers.length > 0 ? ` with ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav navigation={navigation} activeTab="Friends" />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },

  // Create group button in messages view
  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  createGroupIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },

  // Chat list
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  listContentEmpty: { flexGrow: 1 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  groupAvatarSquare: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarIcon: {
    fontSize: 24,
  },
  chatContent: {
    flex: 1,
    gap: 4,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  memberCountLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  chatTime: {
    color: colors.accentMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  chatPreview: {
    color: colors.textMuted,
    fontSize: 13,
  },

  // Tabs for add mode
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabActive: {
    backgroundColor: colors.accentBorder,
    borderColor: colors.accentBorder,
  },
  tabText: {
    color: colors.accentMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabBadge: {
    backgroundColor: colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: colors.accentBorder,
  },
  tabBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  listSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Invite row
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inviteDashedCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  inviteSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // Friend cards
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  friendInfo: {
    flex: 1,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  friendName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  friendYear: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  friendUsername: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 2,
  },
  friendBio: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },

  // ADD friend button
  addFriendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.text,
  },
  addFriendBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },

  // Request actions
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.buttonPrimary,
  },
  acceptBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  declineBtnText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },

  // Discover
  discoverLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  suggestedRow: {
    paddingRight: 16,
    gap: 10,
  },
  suggestedCard: {
    width: 150,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: 8,
  },
  suggestedAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  suggestedAvatarText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  suggestedName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  suggestedMutual: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  suggestedAddBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.text,
    alignItems: 'center',
    marginTop: 4,
  },
  suggestedAddBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyActionBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary,
  },
  emptyActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.modalBg || colors.surface,
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
    marginBottom: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  modalInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  modalSectionLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalFriendRowSelected: {
    backgroundColor: colors.accentBg,
  },
  modalFriendName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  modalCreateBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.buttonPrimary,
  },
  modalCreateBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
