import { supabase } from '../config/supabase';

export const groupChatService = {
  async getGroupConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('group_conversations')
      .select(`
        *,
        group:friend_groups!group_conversations_group_id_fkey(
          id, name, icon, color, owner_id,
          members:friend_group_members(id)
        )
      `)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((conv) => ({
      id: conv.id,
      groupId: conv.group?.id,
      name: conv.group?.name || 'Group',
      icon: conv.group?.icon || '\uD83D\uDC65',
      color: conv.group?.color || '#6AADE4',
      ownerId: conv.group?.owner_id,
      memberCount: conv.group?.members?.length || 0,
      lastMessage: conv.last_message_text,
      lastMessageAt: conv.last_message_at,
    }));
  },

  async getMessages(groupConversationId, { limit = 50, before } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('group_messages')
      .select(`
        id, group_conversation_id, sender_id, text, created_at, metadata,
        sender:profiles!group_messages_sender_id_fkey(id, username, display_name, avatar_url, avatar_color)
      `)
      .eq('group_conversation_id', groupConversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reverse();
  },

  async sendMessage(groupConversationId, text, metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const isEventShare = metadata?.type === 'event_share';
    if (!isEventShare && !text?.trim()) throw new Error('Message cannot be empty');

    // Rate limit: max 30 messages per minute
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'send_group_message',
      p_max_count: 30,
      p_window_minutes: 1,
    });

    if (allowed === false) {
      throw new Error('Slow down! You are sending messages too quickly.');
    }

    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_conversation_id: groupConversationId,
        sender_id: user.id,
        text: isEventShare ? (text || '') : text.trim(),
        metadata,
      })
      .select(`
        *,
        sender:profiles!group_messages_sender_id_fkey(id, username, display_name, avatar_url, avatar_color)
      `)
      .single();

    if (error) throw error;

    // Update conversation last message
    const preview = isEventShare ? 'Shared an event' : text.trim().slice(0, 100);
    await supabase
      .from('group_conversations')
      .update({
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', groupConversationId);

    return data;
  },

  subscribeToGroupMessages(groupConversationId, callback) {
    return supabase
      .channel(`group-messages-${groupConversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_conversation_id=eq.${groupConversationId}`,
      }, callback)
      .subscribe();
  },

  subscribeToGroupConversations(callback) {
    return supabase
      .channel('group-conversations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_conversations',
      }, callback)
      .subscribe();
  },
};
