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
  Star,
  MapPin,
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  X,
  Link2,
} from 'lucide-react-native';
import { friendsService } from '../services/friends.service';
import { friendGroupsService } from '../services/friendGroups.service';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

export default function FriendsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const mapProfile = (p) => ({
    ...p,
    name: p.display_name || p.username,
    avatar: (p.display_name || p.username || 'AN').slice(0, 2).toUpperCase(),
    avatarColor: p.avatar_color || '#6AADE4',
    year: p.graduation_year ? `'${p.graduation_year.slice(-2)}` : '',
    verified: p.is_verified || false,
    mutualFriends: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [friendsData, requestsData, suggestedData, groupsData] = await Promise.all([
        friendsService.getFriends(),
        friendsService.getFriendRequests(),
        friendsService.getSuggestedFriends(),
        friendGroupsService.getGroups().catch(() => []),
      ]);
      setFriends(friendsData.map(mapProfile));
      setRequests(requestsData.map((r) => ({ ...mapProfile(r), request_id: r.request_id })));
      setSuggested(suggestedData.map(mapProfile));
      setGroups(groupsData);
    } catch (err) {
      setError('Failed to load friends. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const sub = friendsService.subscribeFriendships(() => fetchData());
    return () => sub?.unsubscribe();
  }, [fetchData]);

  // Debounced user search for Discover tab
  useEffect(() => {
    if (activeTab !== 'discover' || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await friendsService.searchUsers(searchQuery);
        setSearchResults(results.map(mapProfile));
      } catch {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const tabs = [
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'groups', label: 'Groups', count: groups.length },
    { id: 'requests', label: 'Requests', count: requests.length },
    { id: 'discover', label: 'Discover' },
  ];

  const filteredFriends = friends.filter(
    (f) =>
      (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.username || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddFriend = async (user) => {
    try {
      await friendsService.sendFriendRequest(user.id);
      setSuggested(suggested.filter((s) => s.id !== user.id));
      setSearchResults(searchResults.filter((s) => s.id !== user.id));
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

  const handleRemoveFriend = (user) => {
    Alert.alert('Remove Friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await friendsService.removeFriend(user.friendship_id);
            setFriends(friends.filter((f) => f.id !== user.id));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to remove friend.');
          }
        },
      },
    ]);
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

  const handleDeleteGroup = (group) => {
    Alert.alert('Delete Group', `Delete "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await friendGroupsService.deleteGroup(group.id);
            setGroups(groups.filter((g) => g.id !== group.id));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete group.');
          }
        },
      },
    ]);
  };

  const handleRemoveGroupMember = async (groupId, userId) => {
    try {
      await friendGroupsService.removeMember(groupId, userId);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to remove member.');
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

  const discoverList = activeTab === 'discover' && searchQuery.length >= 2 ? searchResults : suggested;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header - Airbuds-inspired large title + ADD button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>friends</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setActiveTab('discover')}
          accessibilityLabel="Add friends"
          accessibilityRole="button"
        >
          <UserPlus size={16} color={colors.text} strokeWidth={2.5} />
          <Text style={styles.addButtonText}>ADD</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.accentMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for friends"
          placeholderTextColor={colors.accentMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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

          {/* ===== FRIENDS TAB ===== */}
          {activeTab === 'friends' && (
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

              {/* Friends Section Label */}
              {friends.length > 0 && (
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionEmoji}>{'\u{1F499}'}</Text>
                  <Text style={styles.sectionLabel}>Friends</Text>
                </View>
              )}

              {filteredFriends.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={40} color={colors.accentMuted} />
                  <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No results found' : 'No friends yet'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {searchQuery ? 'Try a different search' : 'Discover people to connect with!'}
                  </Text>
                </View>
              ) : (
                filteredFriends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendCard}
                    onLongPress={() => handleRemoveFriend(friend)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.friendAvatar, { backgroundColor: friend.avatarColor }]}>
                      <Text style={styles.friendAvatarText}>{friend.avatar}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <View style={styles.friendNameRow}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        {friend.verified && (
                          <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedText}>{'\u2713'}</Text>
                          </View>
                        )}
                        <Text style={styles.friendYear}>{friend.year}</Text>
                      </View>
                      <Text style={styles.friendUsername}>@{friend.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => navigation.navigate('Chat', { friendId: friend.id })}
                      accessibilityLabel={`Message ${friend.name}`}
                      accessibilityRole="button"
                    >
                      <MessageCircle size={18} color={colors.text} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ===== GROUPS TAB ===== */}
          {activeTab === 'groups' && (
            <View style={styles.listSection}>
              <TouchableOpacity
                style={styles.createGroupBtn}
                onPress={() => setShowCreateGroup(true)}
              >
                <View style={styles.createGroupIcon}>
                  <Plus size={22} color={colors.accent} strokeWidth={2.5} />
                </View>
                <Text style={styles.createGroupText}>Create Group</Text>
              </TouchableOpacity>

              {groups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={40} color={colors.accentMuted} />
                  <Text style={styles.emptyTitle}>No groups yet</Text>
                  <Text style={styles.emptySubtext}>Create a group to organize your friends</Text>
                </View>
              ) : (
                groups.map((group) => {
                  const memberCount = group.members?.length || 0;
                  const isExpanded = expandedGroup === group.id;
                  return (
                    <View key={group.id}>
                      <TouchableOpacity
                        style={styles.groupCard}
                        onPress={() => setExpandedGroup(isExpanded ? null : group.id)}
                        onLongPress={() => handleDeleteGroup(group)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.groupIcon, { backgroundColor: group.color + '20' }]}>
                          <Text style={styles.groupIconText}>{group.icon}</Text>
                        </View>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>{group.name}</Text>
                          <Text style={styles.friendUsername}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
                        </View>
                        {/* Overlapping avatars */}
                        <View style={styles.avatarStack}>
                          {(group.members || []).slice(0, 3).map((m, i) => (
                            <View
                              key={m.id}
                              style={[
                                styles.stackedAvatar,
                                { backgroundColor: m.profile?.avatar_color || '#6AADE4', marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i },
                              ]}
                            >
                              <Text style={styles.stackedAvatarText}>
                                {(m.profile?.display_name || m.profile?.username || '?').slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <ChevronRight
                          size={18}
                          color={colors.textMuted}
                          style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.groupExpanded}>
                          {(group.members || []).map((m) => (
                            <View key={m.id} style={styles.groupMemberRow}>
                              <View style={[styles.smallAvatar, { backgroundColor: m.profile?.avatar_color || '#6AADE4' }]}>
                                <Text style={styles.smallAvatarText}>
                                  {(m.profile?.display_name || m.profile?.username || '?').slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.groupMemberName}>{m.profile?.display_name || m.profile?.username}</Text>
                              <TouchableOpacity
                                onPress={() => handleRemoveGroupMember(group.id, m.user_id)}
                                style={styles.removeMemberBtn}
                              >
                                <X size={14} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {memberCount === 0 && (
                            <Text style={styles.groupEmptyText}>No members yet</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ===== REQUESTS TAB ===== */}
          {activeTab === 'requests' && (
            <View style={styles.listSection}>
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
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => handleAcceptRequest(request)}
                        >
                          <UserCheck size={16} color={colors.text} />
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => handleDeclineRequest(request)}
                        >
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

          {/* ===== DISCOVER TAB ===== */}
          {activeTab === 'discover' && (
            <View style={styles.listSection}>
              {searchQuery.length >= 2 && searchResults.length > 0 && (
                <>
                  <Text style={styles.discoverLabel}>Search Results</Text>
                  {searchResults.map((person) => (
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
              )}

              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <View style={styles.emptyState}>
                  <Search size={40} color={colors.accentMuted} />
                  <Text style={styles.emptyTitle}>No users found</Text>
                  <Text style={styles.emptySubtext}>Try a different name or username</Text>
                </View>
              )}

              {/* Suggested Friends - Horizontal Cards (Airbuds-style) */}
              {suggested.length > 0 && (
                <>
                  <Text style={styles.discoverLabel}>ADD FRIENDS</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestedRow}
                  >
                    {suggested.map((person) => (
                      <View key={person.id} style={styles.suggestedCard}>
                        <View style={[styles.suggestedAvatar, { backgroundColor: person.avatarColor }]}>
                          <Text style={styles.suggestedAvatarText}>{person.avatar}</Text>
                        </View>
                        <Text style={styles.suggestedName} numberOfLines={1}>{person.name}</Text>
                        <Text style={styles.suggestedMutual}>{person.mutualFriends} mutual friend{person.mutualFriends !== 1 ? 's' : ''}</Text>
                        <TouchableOpacity style={styles.suggestedAddBtn} onPress={() => handleAddFriend(person)}>
                          <Text style={styles.suggestedAddBtnText}>ADD</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}

        </Animated.View>
      </ScrollView>

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

  // Invite row (Airbuds-style)
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

  // Section labels
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
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
  friendMeta: {
    color: colors.accentMuted,
    fontSize: 11,
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ADD friend button (pill style like Airbuds)
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

  // Suggested friends horizontal cards (Airbuds-style)
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

  // Groups
  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  createGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  groupCard: {
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
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconText: {
    fontSize: 22,
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 4,
  },
  stackedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  stackedAvatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  groupExpanded: {
    marginLeft: 32,
    marginBottom: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.cardBorder,
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  groupMemberName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  groupEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  removeMemberBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
