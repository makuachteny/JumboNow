import { supabase } from '../config/supabase';

export const chatService = {
  async getConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        p1:profiles!conversations_participant_1_fkey(id, username, display_name, avatar_url, avatar_color, is_verified),
        p2:profiles!conversations_participant_2_fkey(id, username, display_name, avatar_url, avatar_color, is_verified)
      `)
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((conv) => {
      const otherUser = conv.p1.id === user.id ? conv.p2 : conv.p1;
      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.last_message_text,
        lastMessageAt: conv.last_message_at,
      };
    });
  },

  async getOrCreateConversation(otherUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Enforce ordering: smaller UUID = participant_1
    const [p1, p2] = user.id < otherUserId
      ? [user.id, otherUserId]
      : [otherUserId, user.id];

    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .maybeSingle();

    if (existing) return existing.id;

    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_1: p1, participant_2: p2 })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async getMessages(conversationId, { limit = 50, before } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('messages')
      .select(`
        id, conversation_id, sender_id, text, read, created_at, metadata,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, avatar_color)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reverse();
  },

  async sendMessage(conversationId, text, metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const isEventShare = metadata?.type === 'event_share';
    if (!isEventShare && !text?.trim()) throw new Error('Message cannot be empty');

    // Rate limit: max 30 messages per minute
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'send_message',
      p_max_count: 30,
      p_window_minutes: 1,
    });

    if (allowed === false) {
      throw new Error('Slow down! You are sending messages too quickly.');
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: isEventShare ? (text || '') : text.trim(),
        metadata,
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, avatar_color)
      `)
      .single();

    if (error) throw error;

    // Update conversation last message
    const preview = isEventShare ? 'Shared an event' : text.trim().slice(0, 100);
    await supabase
      .from('conversations')
      .update({
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return data;
  },

  async markMessagesRead(conversationId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('read', false);
  },

  async getUnreadCount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', user.id)
      .eq('read', false)
      .in('conversation_id',
        supabase
          .from('conversations')
          .select('id')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      );

    if (error) return 0;
    return count || 0;
  },

  subscribeToMessages(conversationId, callback) {
    return supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, callback)
      .subscribe();
  },

  subscribeToConversations(callback) {
    return supabase
      .channel('conversations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
      }, callback)
      .subscribe();
  },
};
