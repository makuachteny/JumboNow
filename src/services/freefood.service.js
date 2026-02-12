import { supabase } from '../config/supabase';

const isSchemaError = (error) =>
  error?.message?.includes('schema cache') || error?.message?.includes('Could not find');

function generateConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let result = 'JMB-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

export const freeFoodService = {
  async getActivePosts() {
    // Clean up expired posts first
    try { await supabase.rpc('cleanup_expired_free_food'); } catch (_) {}

    const { data, error } = await supabase
      .from('free_food_posts')
      .select(`
        *,
        poster:profiles!free_food_posts_posted_by_fkey(id, username, display_name, avatar_url)
      `)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      if (isSchemaError(error)) return [];
      throw error;
    }
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

  async uploadFoodImage(uri) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('free-food-images')
      .upload(fileName, blob, { contentType: `image/${ext}`, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('free-food-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  },

  async requestFood(postId, { partySize = 1, eta = null, dietaryNotes = null } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const code = generateConfirmationCode();

    // Try with new columns first (requires migration 00024)
    const { data, error } = await supabase
      .from('free_food_requests')
      .insert({
        post_id: postId,
        requester_id: user.id,
        party_size: partySize,
        eta,
        dietary_notes: dietaryNotes,
        confirmation_code: code,
      })
      .select()
      .single();

    if (error) {
      // If new columns don't exist yet, fall back to basic insert
      if (isSchemaError(error)) {
        const { data: fallback, error: fbError } = await supabase
          .from('free_food_requests')
          .insert({ post_id: postId, requester_id: user.id })
          .select()
          .single();

        if (fbError) {
          if (fbError.code === '23505') throw new Error('You already requested this food');
          if (isSchemaError(fbError)) throw new Error('This feature is not available yet. Please try again later.');
          throw fbError;
        }
        // Attach the generated code client-side so the UI can show it
        return { ...fallback, confirmation_code: code, party_size: partySize, eta, dietary_notes: dietaryNotes };
      }
      if (error.code === '23505') throw new Error('You already requested this food');
      throw error;
    }
    return data;
  },

  async getRequests(postId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('free_food_requests')
      .select(`
        *,
        requester:profiles!free_food_requests_requester_id_fkey(id, username, display_name, avatar_url, avatar_color)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isSchemaError(error)) return [];
      throw error;
    }
    return data || [];
  },

  async confirmRequest(requestId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify the user owns the post this request belongs to
    const { data: request } = await supabase
      .from('free_food_requests')
      .select('post_id')
      .eq('id', requestId)
      .single();

    if (request) {
      const { data: post } = await supabase
        .from('free_food_posts')
        .select('posted_by')
        .eq('id', request.post_id)
        .single();

      if (!post || post.posted_by !== user.id) {
        throw new Error('Only the food poster can confirm requests.');
      }
    }

    const { error } = await supabase
      .from('free_food_requests')
      .update({ status: 'confirmed' })
      .eq('id', requestId);

    if (error && !isSchemaError(error)) throw error;
  },

  async declineRequest(requestId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify the user owns the post this request belongs to
    const { data: request } = await supabase
      .from('free_food_requests')
      .select('post_id')
      .eq('id', requestId)
      .single();

    if (request) {
      const { data: post } = await supabase
        .from('free_food_posts')
        .select('posted_by')
        .eq('id', request.post_id)
        .single();

      if (!post || post.posted_by !== user.id) {
        throw new Error('Only the food poster can decline requests.');
      }
    }

    const { error } = await supabase
      .from('free_food_requests')
      .update({ status: 'declined' })
      .eq('id', requestId);

    if (error && !isSchemaError(error)) throw error;
  },

  async getMyRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('free_food_requests')
      .select('*')
      .eq('requester_id', user.id);

    if (error) return [];
    return data || [];
  },

  subscribeToRequests(postId, callback) {
    return supabase
      .channel(`food-requests-${postId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'free_food_requests',
        filter: `post_id=eq.${postId}`,
      }, callback)
      .subscribe();
  },

  async createPost({ title, description, food_type, location_name, latitude, longitude, custom_location_detail, emoji, expires_at, image_url }) {
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
        image_url: image_url || null,
      })
      .select(`
        *,
        poster:profiles!free_food_posts_posted_by_fkey(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      if (isSchemaError(error)) throw new Error('Free food posting is not available yet. The database is being set up.');
      throw error;
    }
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

    if (error && !isSchemaError(error)) throw error;
  },

  async deletePost(postId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_posts')
      .delete()
      .eq('id', postId)
      .eq('posted_by', user.id);

    if (error && !isSchemaError(error)) throw error;
  },

  async isSubscribed() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
      const { data } = await supabase
        .from('free_food_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  },

  async subscribe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_subscriptions')
      .insert({ user_id: user.id });

    if (error && error.code !== '23505') {
      if (error.message?.includes('schema cache')) return; // table not yet created
      throw error;
    }
  },

  async unsubscribe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('free_food_subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (error && error.message?.includes('schema cache')) return; // table not yet created
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
