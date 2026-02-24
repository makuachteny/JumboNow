import { supabase } from '../config/supabase';
import { authService } from './auth.service';

function generateConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory demo reservations
let _demoReservations = [];
let _demoEvents = [];

export const ticketsService = {
  setDemoEvents(events) { _demoEvents = events; },

  async reserveEvent(eventId) {
    if (authService.isDemoMode()) {
      const existing = _demoReservations.find(r => r.event_id === eventId && r.status !== 'cancelled');
      if (existing) throw new Error('You already have a reservation for this event.');
      const code = generateConfirmationCode();
      const reservation = {
        id: `demo-res-${Date.now()}`,
        event_id: eventId,
        user_id: 'demo-user',
        status: 'confirmed',
        reservation_type: 'free_rsvp',
        ticket_type: 'general',
        price_paid: 0,
        confirmation_code: code,
        purchased_at: new Date().toISOString(),
      };
      _demoReservations.push(reservation);
      return reservation;
    }
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
    if (authService.isDemoMode()) {
      const existing = _demoReservations.find(r => r.event_id === eventId && r.status !== 'cancelled');
      if (existing) throw new Error('You already have a ticket for this event.');
      const code = generateConfirmationCode();
      const reservation = {
        id: `demo-res-${Date.now()}`,
        event_id: eventId,
        user_id: 'demo-user',
        status: 'confirmed',
        reservation_type: 'ticket_purchase',
        ticket_type: ticketType,
        price_paid: price,
        confirmation_code: code,
        purchased_at: new Date().toISOString(),
      };
      _demoReservations.push(reservation);
      return reservation;
    }
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
    if (authService.isDemoMode()) {
      const r = _demoReservations.find(r => r.id === reservationId);
      if (r) r.status = 'cancelled';
      return r || { id: reservationId, status: 'cancelled' };
    }
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
    if (authService.isDemoMode()) {
      _demoReservations = _demoReservations.filter(r => r.id !== reservationId);
      return;
    }
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
    if (authService.isDemoMode()) {
      return _demoReservations
        .filter(r => r.status !== 'cancelled')
        .map(r => {
          const event = _demoEvents.find(e => e.id === r.event_id) || null;
          return { ...r, event };
        });
    }
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
    if (authService.isDemoMode()) {
      return _demoReservations
        .filter(r => r.event_id === eventId && r.status !== 'cancelled')
        .map(r => ({ ...r, profile: { id: r.user_id, username: 'demo_user', display_name: 'Demo User' } }));
    }
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
    if (authService.isDemoMode()) {
      return _demoReservations.find(r => r.event_id === eventId && r.status !== 'cancelled') || null;
    }
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
    if (authService.isDemoMode()) {
      const r = _demoReservations.find(r => r.id === reservationId);
      if (r) { r.rating = rating; r.feedback = feedback; r.rated_at = new Date().toISOString(); }
      return r || { id: reservationId, rating, feedback };
    }
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
    if (authService.isDemoMode()) return 4.2;
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
    if (authService.isDemoMode()) {
      return { data: { session: { access_token: 'demo-token' } } };
    }
    return supabase.auth.getSession();
  },

  getWalletPassUrl(reservationId) {
    const url = `${supabase.supabaseUrl}/functions/v1/wallet-pass?reservation_id=${reservationId}`;
    return url;
  },

  subscribeToReservations(callback) {
    if (authService.isDemoMode()) {
      return { unsubscribe: () => {} };
    }
    return supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reservations' }, callback)
      .subscribe();
  },
};
