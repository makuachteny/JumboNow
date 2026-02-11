import { supabase } from '../config/supabase';

const PAGE_SIZE = 20;

export const eventsService = {
  async getEvents({ category, isLive, page = 0 } = {}) {
    let query = supabase
      .from('events')
      .select(`
        *,
        host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
        attendee_count:event_attendees(count)
      `)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (category && category !== 'all') {
      query = query.ilike('category', category);
    }

    if (isLive) {
      const now = new Date().toISOString();
      query = query.lte('start_time', now).gte('end_time', now);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map((event) => ({
      ...event,
      attendee_count: event.attendee_count?.[0]?.count || 0,
    }));
  },

  async getFriendsEvents({ page = 0 } = {}) {
    try {
      const { data: idRows, error: rpcError } = await supabase.rpc('get_friends_event_ids', {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rpcError) throw rpcError;
      if (!idRows || idRows.length === 0) return [];

      const ids = idRows.map((r) => r.id);
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
          attendee_count:event_attendees(count)
        `)
        .in('id', ids)
        .order('start_time', { ascending: true });
      if (error) throw error;

      return (data || []).map((event) => ({
        ...event,
        attendee_count: event.attendee_count?.[0]?.count || 0,
      }));
    } catch {
      // RPC may not exist yet (migration not applied), return empty gracefully
      return [];
    }
  },

  async getFeaturedEvents() {
    let { data, error } = await supabase
      .from('events')
      .select(`
        *,
        host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
        attendee_count:event_attendees(count)
      `)
      .eq('is_featured', true)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    // Fallback: if is_featured column doesn't exist, return first 5 upcoming events
    if (error) {
      ({ data, error } = await supabase
        .from('events')
        .select(`
          *,
          host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
          attendee_count:event_attendees(count)
        `)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5));
      if (error) throw error;
    }

    return (data || []).map((event) => ({
      ...event,
      attendee_count: event.attendee_count?.[0]?.count || 0,
    }));
  },

  async getEventsByFilters({ eventType, eventTypes, isFree, timeRange, page = 0 } = {}) {
    const now = new Date().toISOString();
    const hasCategories = (eventTypes && eventTypes.length > 0) || (eventType && eventType !== 'all');
    const hasPrice = isFree === true || isFree === false;

    const applyTimeRange = (q) => {
      if (timeRange === 'today') {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return q.lte('start_time', endOfDay.toISOString());
      } else if (timeRange === 'this_week') {
        const endOfWeek = new Date();
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        return q.lte('start_time', endOfWeek.toISOString());
      } else if (timeRange === 'this_month') {
        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return q.lte('start_time', endOfMonth.toISOString());
      }
      return q;
    };

    // Try with event_type and ticket_price columns first (from migration 00010)
    let query = supabase
      .from('events')
      .select(`
        *,
        host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
        attendee_count:event_attendees(count)
      `)
      .gte('end_time', now)
      .order('start_time', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (eventTypes && eventTypes.length > 0) {
      query = query.in('event_type', eventTypes);
    } else if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType);
    }

    if (isFree === true) {
      query = query.or('ticket_price.eq.0,ticket_price.is.null');
    } else if (isFree === false) {
      query = query.gt('ticket_price', 0);
    }

    query = applyTimeRange(query);

    let { data, error } = await query;

    // Fallback: if event_type/ticket_price columns don't exist, query without them
    if (error && (hasCategories || hasPrice)) {
      let fallbackQuery = supabase
        .from('events')
        .select(`
          *,
          host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
          attendee_count:event_attendees(count)
        `)
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Try filtering by category column instead
      if (eventTypes && eventTypes.length > 0) {
        const categoryMap = {
          arts_culture: 'Arts', sports: 'Sports', academic: 'Study',
          student_org: 'General', outdoors: 'Sports', campus_center: 'General',
          greek_life: 'General',
        };
        const cats = [...new Set(eventTypes.map(t => categoryMap[t]).filter(Boolean))];
        if (cats.length > 0) fallbackQuery = fallbackQuery.in('category', cats);
      } else if (eventType && eventType !== 'all') {
        fallbackQuery = fallbackQuery.ilike('category', eventType);
      }

      fallbackQuery = applyTimeRange(fallbackQuery);

      ({ data, error } = await fallbackQuery);
      if (error) throw error;
    } else if (error) {
      throw error;
    }

    return (data || []).map((event) => ({
      ...event,
      attendee_count: event.attendee_count?.[0]?.count || 0,
    }));
  },

  async searchEvents(query, { page = 0 } = {}) {
    if (!query || query.trim().length < 2) return [];

    const searchTerms = query.trim().split(/\s+/).join(' & ');
    const q = query.trim().toLowerCase();

    // Try full-text search first, fallback to ilike if search_vector doesn't exist
    let data;
    let error;

    ({ data, error } = await supabase
      .from('events')
      .select(`
        *,
        host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
        attendee_count:event_attendees(count)
      `)
      .textSearch('search_vector', searchTerms)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1));

    // Fallback: if search_vector column doesn't exist, use ilike on title/description/organizer
    if (error) {
      // Sanitize search input to prevent PostgREST filter injection
      const sanitized = q.replace(/[,()\\]/g, '');
      const pattern = `%${sanitized}%`;
      ({ data, error } = await supabase
        .from('events')
        .select(`
          *,
          host:profiles!events_created_by_fkey(id, username, display_name, avatar_url, is_verified),
          attendee_count:event_attendees(count)
        `)
        .or(`title.ilike.${pattern},description.ilike.${pattern},organizer_name.ilike.${pattern},location.ilike.${pattern}`)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1));

      if (error) throw error;
    }

    return (data || []).map((event) => ({
      ...event,
      attendee_count: event.attendee_count?.[0]?.count || 0,
    }));
  },

  async logSearch(query) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !query?.trim()) return;

    await supabase.from('search_logs').insert({
      user_id: user.id,
      query: query.trim().toLowerCase(),
    });
  },

  async getTrendingSearches() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('search_logs')
      .select('query')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];

    // Count frequency and return top 8
    const counts = {};
    data.forEach((row) => {
      counts[row.query] = (counts[row.query] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([query]) => query);
  },

  async getEventById(eventId) {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        host:profiles!events_created_by_fkey(*),
        attendee_count:event_attendees(count)
      `)
      .eq('id', eventId)
      .single();
    if (error) throw error;
    return { ...data, attendee_count: data.attendee_count?.[0]?.count || 0 };
  },

  async createEvent(eventData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Rate limit: max 10 events per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'create_event',
      p_max_count: 10,
      p_window_minutes: 60,
    });

    if (allowed === false) {
      throw new Error('You are creating events too quickly. Please wait a few minutes.');
    }

    let { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, created_by: user.id })
      .select()
      .single();

    // If visibility column doesn't exist yet, retry without it
    if (error && eventData.visibility) {
      const { visibility, ...rest } = eventData;
      ({ data, error } = await supabase
        .from('events')
        .insert({ ...rest, created_by: user.id })
        .select()
        .single());
    }

    if (error) throw error;

    // Check achievements
    await supabase.rpc('check_and_unlock_achievements', { p_user_id: user.id }).catch(() => {});

    return data;
  },

  async updateEvent(eventId, eventData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select()
      .single();

    // If visibility column doesn't exist yet, retry without it
    if (error && eventData.visibility) {
      const { visibility, ...rest } = eventData;
      ({ data, error } = await supabase
        .from('events')
        .update(rest)
        .eq('id', eventId)
        .eq('created_by', user.id)
        .select()
        .single());
    }

    if (error) throw error;
    return data;
  },

  async deleteEvent(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('created_by', user.id);
    if (error) throw error;
  },

  async joinEvent(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const already = await this.isAttending(eventId);
    if (already) return;

    // Check capacity before joining
    const event = await this.getEventById(eventId);
    if (event.attendee_count >= event.max_capacity) {
      throw new Error('This event is at full capacity.');
    }

    const { data, error } = await supabase
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    // Check achievements
    await supabase.rpc('check_and_unlock_achievements', { p_user_id: user.id }).catch(() => {});

    return data;
  },

  async leaveEvent(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id);
    if (error) throw error;
  },

  async isAttending(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    return !!data;
  },

  async getSavedEventIds() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', user.id);
    if (error) return [];
    return data.map((d) => d.event_id);
  },

  async getSavedEventCount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('event_attendees')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (error) return 0;
    return data?.length || 0;
  },

  async inviteFriendToEvent(eventId, inviteeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_invitations')
      .upsert(
        { event_id: eventId, inviter_id: user.id, invitee_id: inviteeId },
        { onConflict: 'event_id,invitee_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async inviteGroupToEvent(eventId, groupId) {
    const { data: members, error: membersError } = await supabase
      .from('friend_group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) throw membersError;
    if (!members || members.length === 0) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const rows = members.map((m) => ({
      event_id: eventId,
      inviter_id: user.id,
      invitee_id: m.user_id,
    }));

    const { data, error } = await supabase
      .from('event_invitations')
      .upsert(rows, { onConflict: 'event_id,invitee_id' })
      .select();

    if (error) throw error;
    return data;
  },

  async getMyInvitations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_invitations')
      .select(`
        *,
        event:events(id, title, icon, start_time, location),
        inviter:profiles!event_invitations_inviter_id_fkey(id, username, display_name, avatar_color)
      `)
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async respondToInvitation(invitationId, status) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_invitations')
      .update({ status })
      .eq('id', invitationId)
      .eq('invitee_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToEvents(callback) {
    return supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendees' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reservations' }, callback)
      .subscribe();
  },
};
