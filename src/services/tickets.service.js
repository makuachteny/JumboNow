import { supabase } from '../config/supabase';

function generateConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const ticketsService = {
  async reserveEvent(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check for existing active reservation
    const { data: existing } = await supabase
      .from('event_reservations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) throw new Error('You already have a reservation for this event.');

    const code = generateConfirmationCode();

    const { data: reservation, error } = await supabase
      .from('event_reservations')
      .insert({
        event_id: eventId,
        user_id: user.id,
        status: 'confirmed',
        reservation_type: 'free_rsvp',
        ticket_type: 'general',
        price_paid: 0,
        confirmation_code: code,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('You already have a reservation for this event.');
      throw error;
    }

    return reservation;
  },

  async purchaseTicket(eventId, ticketType, price) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check for existing active reservation
    const { data: existing } = await supabase
      .from('event_reservations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) throw new Error('You already have a ticket for this event.');

    const code = generateConfirmationCode();

    const { data: reservation, error } = await supabase
      .from('event_reservations')
      .insert({
        event_id: eventId,
        user_id: user.id,
        status: 'confirmed',
        reservation_type: 'ticket_purchase',
        ticket_type: ticketType,
        price_paid: price,
        confirmation_code: code,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('You already have a ticket for this event.');
      throw error;
    }

    return reservation;
  },

  async cancelReservation(reservationId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteReservation(reservationId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('event_reservations')
      .delete()
      .eq('id', reservationId)
      .eq('user_id', user.id);
    if (error) throw error;
  },

  async getMyTickets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_reservations')
      .select(`
        id, event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code, purchased_at, rating, feedback, rated_at,
        event:events(id, title, subtitle, description, icon, color, gradient_colors, category, location, start_time, end_time, max_capacity, tags, energy, vibe, event_type, ticket_price, is_free, organizer_name, organizer_icon, image_url, is_featured, created_by)
      `)
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getEventAttendees(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify the user is the event creator before exposing attendee data
    const { data: event } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', eventId)
      .single();

    if (!event || event.created_by !== user.id) {
      throw new Error('Only the event creator can view attendees.');
    }

    const { data, error } = await supabase
      .from('event_reservations')
      .select(`
        id, event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code, purchased_at,
        profile:profiles!event_reservations_user_id_fkey(
          id, username, display_name, avatar_url, avatar_color
        )
      `)
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('purchased_at', { ascending: false });

    if (error) {
      // Fallback: if the foreign key name doesn't match, try without profile join
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('event_reservations')
        .select('id, event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code, purchased_at')
        .eq('event_id', eventId)
        .neq('status', 'cancelled')
        .order('purchased_at', { ascending: false });
      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }

    return data || [];
  },

  async getReservationForEvent(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('event_reservations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .maybeSingle();
    return data;
  },

  async submitRating(reservationId, rating, feedback) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_reservations')
      .update({ rating, feedback: feedback || null, rated_at: new Date().toISOString() })
      .eq('id', reservationId)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMyAverageRating() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('event_reservations')
      .select('rating')
      .eq('user_id', user.id)
      .not('rating', 'is', null);
    if (error) return 0;
    if (!data || data.length === 0) return 0;

    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    return sum / data.length;
  },

  async getSession() {
    return supabase.auth.getSession();
  },

  getWalletPassUrl(reservationId) {
    const url = `${supabase.supabaseUrl}/functions/v1/wallet-pass?reservation_id=${reservationId}`;
    return url;
  },

  subscribeToReservations(callback) {
    return supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reservations' }, callback)
      .subscribe();
  },
};
