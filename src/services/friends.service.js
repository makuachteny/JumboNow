import { supabase } from '../config/supabase';

export const friendsService = {
  async getFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        status,
        created_at,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, avatar_color, is_verified, graduation_year, bio),
        addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, avatar_color, is_verified, graduation_year, bio)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) throw error;

    return data.map((f) => {
      const friend = f.requester.id === user.id ? f.addressee : f.requester;
      return { ...friend, friendship_id: f.id };
    });
  },

  async getFriendRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        created_at,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, avatar_color, is_verified, graduation_year, bio)
      `)
      .eq('addressee_id', user.id)
      .eq('status', 'pending');

    if (error) throw error;
    return data.map((r) => ({ ...r.requester, request_id: r.id }));
  },

  async sendFriendRequest(addresseeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Rate limit: max 20 friend requests per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'friend_request',
      p_max_count: 20,
      p_window_minutes: 60,
    });

    if (allowed === false) {
      throw new Error('You are sending too many friend requests. Please wait a bit.');
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: addresseeId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async acceptRequest(friendshipId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .eq('addressee_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async declineRequest(friendshipId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('addressee_id', user.id);
    if (error) throw error;
  },

  async removeFriend(friendshipId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (error) throw error;
  },

  async getSuggestedFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get IDs of existing friends and pending requests
    const { data: existing } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const excludeIds = new Set([user.id]);
    (existing || []).forEach((f) => {
      excludeIds.add(f.requester_id);
      excludeIds.add(f.addressee_id);
    });

    // Validate all IDs are proper UUIDs before using in filter
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = [...excludeIds].filter((id) => uuidRegex.test(id));

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .not('id', 'in', `(${safeIds.join(',')})`)
      .limit(10);

    if (error) throw error;
    return data;
  },

  async searchUsers(query) {
    if (!query || query.trim().length < 2) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Sanitize search input to prevent PostgREST filter injection
    const sanitized = query.trim().replace(/[,()\\]/g, '');
    if (sanitized.length < 2) return [];
    const pattern = `%${sanitized}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, avatar_color, is_verified, graduation_year, bio')
      .neq('id', user.id)
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },

  subscribeFriendships(callback) {
    return supabase
      .channel('friendships-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, callback)
      .subscribe();
  },
};
