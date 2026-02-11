import { supabase } from '../config/supabase';

export const freeFoodService = {
  async getActivePosts() {
    // Clean up expired posts first
    await supabase.rpc('cleanup_expired_free_food').catch(() => {});

    const { data, error } = await supabase
      .from('free_food_posts')
      .select(`
        *,
        poster:profiles!free_food_posts_posted_by_fkey(id, username, display_name, avatar_url)
      `)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveCount() {
    const { count, error } = await supabase
      .from('free_food_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString());

    if (error) return 0;
    return count || 0;
  },

  async createPost({ title, description, food_type, location_name, latitude, longitude, custom_location_detail, emoji, expires_at }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Rate limit: max 5 posts per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'free_food_post',
      p_max_count: 5,
      p_window_minutes: 60,
    });

    if (allowed === false) {
      throw new Error('You are posting too quickly. Please wait a few minutes.');
    }

    const { data, error } = await supabase
      .from('free_food_posts')
      .insert({
        posted_by: user.id,
        title,
        description: description || null,
        food_type: food_type || 'other',
        location_name,
        latitude: latitude || null,
        longitude: longitude || null,
        custom_location_detail: custom_location_detail || null,
        emoji: emoji || '\u{1F355}',
        expires_at,
      })
      .select(`
        *,
        poster:profiles!free_food_posts_posted_by_fkey(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deactivatePost(postId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_posts')
      .update({ is_active: false })
      .eq('id', postId)
      .eq('posted_by', user.id);

    if (error) throw error;
  },

  async deletePost(postId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_posts')
      .delete()
      .eq('id', postId)
      .eq('posted_by', user.id);

    if (error) throw error;
  },

  async isSubscribed() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('free_food_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    return !!data;
  },

  async subscribe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_subscriptions')
      .insert({ user_id: user.id });

    if (error && error.code !== '23505') throw error; // ignore duplicate
  },

  async unsubscribe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;
  },

  subscribeToNewPosts(callback) {
    return supabase
      .channel('free-food-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'free_food_posts' }, callback)
      .subscribe();
  },

  subscribeToPostChanges(callback) {
    return supabase
      .channel('free-food-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'free_food_posts' }, callback)
      .subscribe();
  },
};
