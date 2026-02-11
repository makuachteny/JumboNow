-- ============================================================
-- COMPREHENSIVE UPDATE MIGRATION
-- Addresses: capacity enforcement, ticket inventory, rate limiting,
-- profile fields, achievements, reports, chat, vibe score,
-- full-text search, trending, cleanup
-- ============================================================

-- 1. Add major and campus columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS major TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Tufts University - Medford';

-- 2. Capacity enforcement function (atomic check + insert)
CREATE OR REPLACE FUNCTION public.reserve_event_with_capacity(
  p_event_id UUID,
  p_user_id UUID,
  p_reservation_type TEXT DEFAULT 'free_rsvp',
  p_ticket_type TEXT DEFAULT 'general',
  p_price DECIMAL DEFAULT 0,
  p_confirmation_code TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
  v_max_capacity INTEGER;
  v_current_count INTEGER;
  v_reservation_id UUID;
BEGIN
  -- Lock the event row to prevent race conditions
  SELECT max_capacity INTO v_max_capacity
  FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Count current non-cancelled reservations
  SELECT COUNT(*) INTO v_current_count
  FROM public.event_reservations
  WHERE event_id = p_event_id AND status != 'cancelled';

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'Event is at full capacity';
  END IF;

  -- Check for duplicate
  IF EXISTS (
    SELECT 1 FROM public.event_reservations
    WHERE event_id = p_event_id AND user_id = p_user_id AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'You already have a reservation for this event';
  END IF;

  -- Insert reservation
  INSERT INTO public.event_reservations (
    event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code
  ) VALUES (
    p_event_id, p_user_id,
    CASE WHEN v_current_count >= v_max_capacity - 1 THEN 'confirmed' ELSE 'confirmed' END,
    p_reservation_type, p_ticket_type, p_price, p_confirmation_code
  ) RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ticket inventory decrement function
CREATE OR REPLACE FUNCTION public.purchase_ticket_with_inventory(
  p_event_id UUID,
  p_user_id UUID,
  p_ticket_type TEXT,
  p_price DECIMAL,
  p_confirmation_code TEXT
) RETURNS UUID AS $$
DECLARE
  v_event RECORD;
  v_ticket_types JSONB;
  v_idx INTEGER;
  v_available INTEGER;
  v_reservation_id UUID;
  v_current_count INTEGER;
BEGIN
  -- Lock event row
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_current_count
  FROM public.event_reservations
  WHERE event_id = p_event_id AND status != 'cancelled';

  IF v_current_count >= v_event.max_capacity THEN
    RAISE EXCEPTION 'Event is at full capacity';
  END IF;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM public.event_reservations
    WHERE event_id = p_event_id AND user_id = p_user_id AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'You already have a ticket for this event';
  END IF;

  -- Find and validate ticket type inventory
  v_ticket_types := v_event.ticket_types;
  IF v_ticket_types IS NOT NULL AND jsonb_array_length(v_ticket_types) > 0 THEN
    FOR v_idx IN 0..jsonb_array_length(v_ticket_types) - 1 LOOP
      IF v_ticket_types->v_idx->>'name' = p_ticket_type THEN
        v_available := (v_ticket_types->v_idx->>'available')::INTEGER;
        IF v_available <= 0 THEN
          RAISE EXCEPTION 'This ticket type is sold out';
        END IF;
        -- Decrement available count
        v_ticket_types := jsonb_set(
          v_ticket_types,
          ARRAY[v_idx::TEXT, 'available'],
          to_jsonb(v_available - 1)
        );
        -- Update event ticket_types
        UPDATE public.events SET ticket_types = v_ticket_types WHERE id = p_event_id;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Validate price
  IF v_ticket_types IS NOT NULL AND jsonb_array_length(v_ticket_types) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_event.ticket_types) elem
      WHERE elem->>'name' = p_ticket_type AND (elem->>'price')::DECIMAL = p_price
    ) THEN
      IF p_price != v_event.ticket_price THEN
        RAISE EXCEPTION 'Ticket price mismatch';
      END IF;
    END IF;
  END IF;

  -- Insert reservation
  INSERT INTO public.event_reservations (
    event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code
  ) VALUES (
    p_event_id, p_user_id, 'confirmed', 'ticket_purchase',
    p_ticket_type, p_price, p_confirmation_code
  ) RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_count INTEGER,
  p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_count >= p_max_count THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action) VALUES (p_user_id, p_action);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limit log table
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action ON public.rate_limit_log (user_id, action, created_at);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 5. Achievements system
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement_type TEXT NOT NULL, -- 'events_attended', 'tickets_purchased', 'friends_count', 'paid_events', 'late_night_events', 'study_sessions'
  requirement_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Seed achievements
INSERT INTO public.achievements (key, icon, title, description, requirement_type, requirement_count) VALUES
  ('first_event', '🎉', 'First Timer', 'Attend your first event', 'events_attended', 1),
  ('five_events', '🔥', 'Trailblazer', 'Attend 5+ events', 'events_attended', 5),
  ('twenty_events', '⚡', 'Event Machine', 'Attend 20+ events', 'events_attended', 20),
  ('hundred_events', '🏆', 'Legend', 'Attend 100+ events', 'events_attended', 100),
  ('five_paid', '💎', 'Big Spender', 'Purchase 5+ paid tickets', 'paid_events', 5),
  ('first_friend', '🤝', 'Social Butterfly', 'Make your first friend', 'friends_count', 1),
  ('twenty_five_friends', '🌟', 'Connector', 'Make 25+ friends', 'friends_count', 25),
  ('night_owl', '🦉', 'Night Owl', 'Attend 10+ evening events', 'late_night_events', 10),
  ('scholar', '🧠', 'Scholar', 'Attend 15+ academic events', 'study_sessions', 15),
  ('creator', '🎨', 'Event Creator', 'Create your first event', 'events_created', 1)
ON CONFLICT (key) DO NOTHING;

-- 6. Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reported_type TEXT NOT NULL CHECK (reported_type IN ('event', 'user', 'message')),
  reported_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'other')),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- 7. Conversations and messages tables for chat
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2),
  CHECK (participant_1 < participant_2) -- Enforce ordering to prevent duplicates
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in own conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations (participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations (participant_2);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);

-- 8. Search logs for trending
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs (query, created_at);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log searches" ON public.search_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view search logs" ON public.search_logs
  FOR SELECT TO authenticated USING (true);

-- 9. Vibe score calculation function
CREATE OR REPLACE FUNCTION public.calculate_vibe_score(p_user_id UUID) RETURNS INTEGER AS $$
DECLARE
  v_events INTEGER;
  v_tickets INTEGER;
  v_friends INTEGER;
  v_score INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_events FROM public.event_attendees WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_tickets FROM public.event_reservations WHERE user_id = p_user_id AND status = 'confirmed';
  SELECT COUNT(*) INTO v_friends FROM public.friendships
    WHERE (requester_id = p_user_id OR addressee_id = p_user_id) AND status = 'accepted';

  v_score := LEAST(100, 10 + (v_events * 3) + (v_tickets * 5) + (v_friends * 2));
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update vibe score and counts after reservation
CREATE OR REPLACE FUNCTION public.update_profile_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    tickets_count = (SELECT COUNT(*) FROM public.event_reservations WHERE user_id = NEW.user_id AND status = 'confirmed'),
    events_attended = (SELECT COUNT(*) FROM public.event_attendees WHERE user_id = NEW.user_id),
    vibe_score = public.calculate_vibe_score(NEW.user_id)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_stats_on_reservation ON public.event_reservations;
CREATE TRIGGER update_stats_on_reservation
  AFTER INSERT OR UPDATE ON public.event_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_stats();

DROP TRIGGER IF EXISTS update_stats_on_attendance ON public.event_attendees;
CREATE TRIGGER update_stats_on_attendance
  AFTER INSERT OR DELETE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_stats();

-- Trigger to update vibe on friendship changes
CREATE OR REPLACE FUNCTION public.update_vibe_on_friendship() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles SET vibe_score = public.calculate_vibe_score(NEW.requester_id) WHERE id = NEW.requester_id;
    UPDATE public.profiles SET vibe_score = public.calculate_vibe_score(NEW.addressee_id) WHERE id = NEW.addressee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_vibe_on_friendship ON public.friendships;
CREATE TRIGGER update_vibe_on_friendship
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_vibe_on_friendship();

-- 10. Full-text search index on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.update_event_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(NEW.organizer_name, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_search_vector_update ON public.events;
CREATE TRIGGER event_search_vector_update
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_event_search_vector();

-- Backfill existing events
UPDATE public.events SET search_vector = to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(organizer_name, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '')
);

CREATE INDEX IF NOT EXISTS idx_events_search ON public.events USING gin(search_vector);

-- 11. Device tokens for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'ios',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens" ON public.device_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. Add major/campus to profile allowed updates (handled in service layer)
-- Update existing profiles to have allowed fields for updateProfile

-- 13. Check achievement function
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID) RETURNS void AS $$
DECLARE
  v_achievement RECORD;
  v_count INTEGER;
BEGIN
  FOR v_achievement IN SELECT * FROM public.achievements LOOP
    -- Skip if already unlocked
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.user_achievements
      WHERE user_id = p_user_id AND achievement_id = v_achievement.id
    );

    -- Check requirement
    CASE v_achievement.requirement_type
      WHEN 'events_attended' THEN
        SELECT COUNT(*) INTO v_count FROM public.event_attendees WHERE user_id = p_user_id;
      WHEN 'paid_events' THEN
        SELECT COUNT(*) INTO v_count FROM public.event_reservations
        WHERE user_id = p_user_id AND reservation_type = 'ticket_purchase' AND status = 'confirmed';
      WHEN 'friends_count' THEN
        SELECT COUNT(*) INTO v_count FROM public.friendships
        WHERE (requester_id = p_user_id OR addressee_id = p_user_id) AND status = 'accepted';
      WHEN 'events_created' THEN
        SELECT COUNT(*) INTO v_count FROM public.events WHERE created_by = p_user_id;
      WHEN 'late_night_events' THEN
        SELECT COUNT(*) INTO v_count FROM public.event_attendees ea
        JOIN public.events e ON ea.event_id = e.id
        WHERE ea.user_id = p_user_id AND EXTRACT(HOUR FROM e.start_time) >= 20;
      WHEN 'study_sessions' THEN
        SELECT COUNT(*) INTO v_count FROM public.event_attendees ea
        JOIN public.events e ON ea.event_id = e.id
        WHERE ea.user_id = p_user_id AND e.event_type = 'academic';
      ELSE
        v_count := 0;
    END CASE;

    IF v_count >= v_achievement.requirement_count THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages rate limits" ON public.rate_limit_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS for user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System unlocks achievements" ON public.user_achievements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
