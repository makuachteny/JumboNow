import { supabase } from '../config/supabase';

export const friendGroupsService = {
  async getGroups() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friend_groups')
      .select(`
        id, name, icon, color, owner_id, created_at,
        members:friend_group_members(
          id,
          user_id,
          profile:profiles!friend_group_members_user_id_fkey(id, username, display_name, avatar_url, avatar_color)
        ),
        conversation:group_conversations(id, last_message_text, last_message_at)
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createGroup(name, icon = '👥', color = '#418FDE') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friend_groups')
      .insert({ owner_id: user.id, name, icon, color })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteGroup(groupId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('friend_groups')
      .delete()
      .eq('id', groupId)
      .eq('owner_id', user.id);

    if (error) throw error;
  },

  async addMember(groupId, userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify group ownership
    const { data: group } = await supabase
      .from('friend_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== user.id) {
      throw new Error('Only the group owner can add members.');
    }

    const { error } = await supabase
      .from('friend_group_members')
      .insert({ group_id: groupId, user_id: userId });

    if (error) throw error;
  },

  async removeMember(groupId, userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify group ownership
    const { data: group } = await supabase
      .from('friend_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== user.id) {
      throw new Error('Only the group owner can remove members.');
    }

    const { error } = await supabase
      .from('friend_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async addMultipleMembers(groupId, userIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify group ownership
    const { data: group } = await supabase
      .from('friend_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== user.id) {
      throw new Error('Only the group owner can add members.');
    }

    const rows = userIds.map((userId) => ({ group_id: groupId, user_id: userId }));
    const { error } = await supabase
      .from('friend_group_members')
      .upsert(rows, { onConflict: 'group_id,user_id' });

    if (error) throw error;
  },
};
