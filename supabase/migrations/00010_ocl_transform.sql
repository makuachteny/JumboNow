-- Phase 1: Transform JumboNow into OCL Events Platform

-- 1a. Add new columns to events table
ALTER TABLE public.events
  ADD COLUMN ticket_price decimal DEFAULT 0,
  ADD COLUMN is_free boolean GENERATED ALWAYS AS (ticket_price = 0) STORED,
  ADD COLUMN requires_reservation boolean DEFAULT true,
  ADD COLUMN event_type text DEFAULT 'general'
    CHECK (event_type IN ('general', 'student_org', 'outdoors', 'campus_center', 'greek_life', 'arts_culture', 'academic', 'sports')),
  ADD COLUMN organizer_name text,
  ADD COLUMN organizer_icon text DEFAULT '🐘',
  ADD COLUMN image_url text,
  ADD COLUMN ticket_types jsonb DEFAULT '[]',
  ADD COLUMN is_featured boolean DEFAULT false;

-- Add indexes for common queries
CREATE INDEX idx_events_event_type ON public.events(event_type);
CREATE INDEX idx_events_is_featured ON public.events(is_featured);
CREATE INDEX idx_events_ticket_price ON public.events(ticket_price);

-- 1b. Create event_reservations table
CREATE TABLE public.event_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  reservation_type text CHECK (reservation_type IN ('free_rsvp', 'ticket_purchase')),
  ticket_type text DEFAULT 'general',
  price_paid decimal DEFAULT 0,
  confirmation_code text NOT NULL,
  purchased_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_reservations_user ON public.event_reservations(user_id);
CREATE INDEX idx_reservations_event ON public.event_reservations(event_id);
CREATE INDEX idx_reservations_status ON public.event_reservations(status);
CREATE INDEX idx_reservations_code ON public.event_reservations(confirmation_code);

-- 1c. RLS policies for event_reservations
ALTER TABLE public.event_reservations ENABLE ROW LEVEL SECURITY;

-- Users can see their own reservations
CREATE POLICY "Users can view own reservations"
  ON public.event_reservations FOR SELECT
  USING (auth.uid() = user_id);

-- Event hosts can see reservations for their events
CREATE POLICY "Hosts can view event reservations"
  ON public.event_reservations FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );

-- Users can create their own reservations
CREATE POLICY "Users can create own reservations"
  ON public.event_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reservations
CREATE POLICY "Users can update own reservations"
  ON public.event_reservations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own reservations
CREATE POLICY "Users can delete own reservations"
  ON public.event_reservations FOR DELETE
  USING (auth.uid() = user_id);

-- 1d. Function to generate confirmation codes
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 1e. Trigger for reservation notifications
CREATE OR REPLACE FUNCTION public.handle_reservation_created()
RETURNS trigger AS $$
BEGIN
  -- Notify the user (confirmation)
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (
    NEW.user_id,
    'reservation',
    '🎟️',
    CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP Confirmed!' ELSE 'Ticket Purchased!' END,
    'Your confirmation code is ' || NEW.confirmation_code,
    'events',
    '#22C55E'
  );

  -- Notify the event host
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  SELECT
    e.created_by,
    'new_reservation',
    '🎟️',
    'New ' || CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP' ELSE 'ticket purchase' END,
    'Someone reserved a spot at your event: ' || e.title,
    'events',
    '#3B82F6'
  FROM public.events e
  WHERE e.id = NEW.event_id AND e.created_by IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_reservation_created
  AFTER INSERT ON public.event_reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_created();

-- 1f. Rename activities_created to tickets_count
ALTER TABLE public.profiles RENAME COLUMN activities_created TO tickets_count;
