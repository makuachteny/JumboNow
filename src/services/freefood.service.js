import { supabase } from '../config/supabase';
import { authService } from './auth.service';

const isSchemaError = (error) =>
  error?.message?.includes('schema cache') || error?.message?.includes('Could not find');

function generateConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'JMB-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory demo data for free food
let _demoPosts = [];
let _demoRequests = [];
let _demoSubscribed = false;

export const freeFoodService = {
  async getActivePosts() {
    if (authService.isDemoMode()) {
      return _demoPosts.filter(p => p.is_active && new Date(p.expires_at) > new Date());
    }
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
    if (authService.isDemoMode()) {
      return _demoPosts.filter(p => p.is_active && new Date(p.expires_at) > new Date()).length;
    }
    const { count, error } = await supabase
      .from('free_food_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString());

    if (error) return 0;
    return count || 0;
  },

  async uploadFoodImage(uri) {
    if (authService.isDemoMode()) {
      return uri; // In demo mode, just return the original URI
    }
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
    if (authService.isDemoMode()) {
      const existing = _demoRequests.find(r => r.post_id === postId && r.requester_id === 'demo-user');
      if (existing) throw new Error('You already requested this food');
      const code = generateConfirmationCode();
      const request = {
        id: `demo-req-${Date.now()}`,
        post_id: postId,
        requester_id: 'demo-user',
        party_size: partySize,
        eta,
        dietary_notes: dietaryNotes,
        confirmation_code: code,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      _demoRequests.push(request);
      return request;
    }
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
    if (authService.isDemoMode()) {
      return _demoRequests
        .filter(r => r.post_id === postId)
        .map(r => ({ ...r, requester: { id: r.requester_id, username: 'demo_user', display_name: 'Demo User', avatar_url: null, avatar_color: '#418FDE' } }));
    }
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
    if (authService.isDemoMode()) {
      const r = _demoRequests.find(r => r.id === requestId);
      if (r) r.status = 'confirmed';
      return;
    }
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
    if (authService.isDemoMode()) {
      const r = _demoRequests.find(r => r.id === requestId);
      if (r) r.status = 'declined';
      return;
    }
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
    if (authService.isDemoMode()) {
      return _demoRequests.filter(r => r.requester_id === 'demo-user');
    }
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
    if (authService.isDemoMode()) {
      return { unsubscribe: () => {} };
    }
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
    if (authService.isDemoMode()) {
      const post = {
        id: `demo-food-${Date.now()}`,
        posted_by: 'demo-user',
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
        is_active: true,
        created_at: new Date().toISOString(),
        poster: { id: 'demo-user', username: 'demo_user', display_name: 'Demo User', avatar_url: null },
      };
      _demoPosts.push(post);
      return post;
    }
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
    if (authService.isDemoMode()) {
      const p = _demoPosts.find(p => p.id === postId);
      if (p) p.is_active = false;
      return;
    }
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
    if (authService.isDemoMode()) {
      _demoPosts = _demoPosts.filter(p => p.id !== postId);
      return;
    }
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
    if (authService.isDemoMode()) return _demoSubscribed;
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
    if (authService.isDemoMode()) { _demoSubscribed = true; return; }
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
    if (authService.isDemoMode()) { _demoSubscribed = false; return; }
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
    if (authService.isDemoMode()) return { unsubscribe: () => {} };
    return supabase
      .channel('free-food-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'free_food_posts' }, callback)
      .subscribe();
  },

  subscribeToPostChanges(callback) {
    if (authService.isDemoMode()) return { unsubscribe: () => {} };
    return supabase
      .channel('free-food-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'free_food_posts' }, callback)
      .subscribe();
  },
};
