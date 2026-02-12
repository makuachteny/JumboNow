-- ============================================================
-- Combined Migrations 00016 through 00023
-- Run this in a single go in the Supabase SQL Editor
-- All statements are idempotent (safe to re-run)
-- ============================================================


-- ============================================================
-- MIGRATION 00016: Comprehensive Updates
-- (chat, achievements, rate limiting, reports, search, vibe score)
-- ============================================================

-- 1. Add major and campus columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS major TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Tufts University - Medford';

-- 2. Capacity enforcement function
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
  SELECT max_capacity INTO v_max_capacity
  FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.event_reservations
  WHERE event_id = p_event_id AND status != 'cancelled';

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'Event is at full capacity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_reservations
    WHERE event_id = p_event_id AND user_id = p_user_id AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'You already have a reservation for this event';
  END IF;

  INSERT INTO public.event_reservations (
    event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code
  ) VALUES (
    p_event_id, p_user_id, 'confirmed',
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
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.event_reservations
  WHERE event_id = p_event_id AND status != 'cancelled';

  IF v_current_count >= v_event.max_capacity THEN
    RAISE EXCEPTION 'Event is at full capacity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_reservations
    WHERE event_id = p_event_id AND user_id = p_user_id AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'You already have a ticket for this event';
  END IF;

  v_ticket_types := v_event.ticket_types;
  IF v_ticket_types IS NOT NULL AND jsonb_array_length(v_ticket_types) > 0 THEN
    FOR v_idx IN 0..jsonb_array_length(v_ticket_types) - 1 LOOP
      IF v_ticket_types->v_idx->>'name' = p_ticket_type THEN
        v_available := (v_ticket_types->v_idx->>'available')::INTEGER;
        IF v_available <= 0 THEN
          RAISE EXCEPTION 'This ticket type is sold out';
        END IF;
        v_ticket_types := jsonb_set(
          v_ticket_types,
          ARRAY[v_idx::TEXT, 'available'],
          to_jsonb(v_available - 1)
        );
        UPDATE public.events SET ticket_types = v_ticket_types WHERE id = p_event_id;
        EXIT;
      END IF;
    END LOOP;
  END IF;

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

  INSERT INTO public.event_reservations (
    event_id, user_id, status, reservation_type, ticket_type, price_paid, confirmation_code
  ) VALUES (
    p_event_id, p_user_id, 'confirmed', 'ticket_purchase',
    p_ticket_type, p_price, p_confirmation_code
  ) RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action ON public.rate_limit_log (user_id, action, created_at);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "System manages rate limits" ON public.rate_limit_log
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
  requirement_type TEXT NOT NULL,
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

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view all achievements" ON public.user_achievements
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System unlocks achievements" ON public.user_achievements
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DO $$ BEGIN
  CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own reports" ON public.reports
    FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Conversations and messages tables for chat
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2),
  CHECK (participant_1 < participant_2)
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

DO $$ BEGIN
  CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view messages in own conversations" ON public.messages
    FOR SELECT TO authenticated
    USING (
      conversation_id IN (
        SELECT id FROM public.conversations
        WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can send messages in own conversations" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = sender_id AND
      conversation_id IN (
        SELECT id FROM public.conversations
        WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE TO authenticated
    USING (
      conversation_id IN (
        SELECT id FROM public.conversations
        WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DO $$ BEGIN
  CREATE POLICY "Users can log searches" ON public.search_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view search logs" ON public.search_logs
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Vibe score calculation
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

-- Backfill existing events search vectors
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

DO $$ BEGIN
  CREATE POLICY "Users manage own device tokens" ON public.device_tokens
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 13. Check achievement function
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID) RETURNS void AS $$
DECLARE
  v_achievement RECORD;
  v_count INTEGER;
BEGIN
  FOR v_achievement IN SELECT * FROM public.achievements LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.user_achievements
      WHERE user_id = p_user_id AND achievement_id = v_achievement.id
    );

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

-- Enable realtime for conversations and messages
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- MIGRATION 00017: Africana Center Event (seed data)
-- ============================================================
INSERT INTO public.events (
  title, subtitle, description, icon, color, gradient_colors, category, event_type,
  location, start_time, end_time, max_capacity, tags, organizer_name, organizer_icon,
  image_url, ticket_price, is_featured
) SELECT
  'Africana Center: Heritage Night',
  'Center for Africana Studies',
  'Join the Africana Center for an evening celebrating African and African-American heritage at Tufts University. Featuring live performances, guest speakers, traditional cuisine, and community dialogue. Open to all students, faculty, and staff. Come celebrate the richness of Africana culture and connect with your campus community.',
  '🌍', '#8B2500', '{"#8B2500","#CD6600","#DAA520"}', 'General', 'arts_culture',
  'Africana Center, Tufts University',
  (NOW() + INTERVAL '7 days')::timestamptz,
  (NOW() + INTERVAL '7 days' + INTERVAL '3 hours')::timestamptz,
  150,
  '{"culture","heritage","community","africana","diversity"}',
  'Africana Center', '🌍',
  'https://images.unsplash.com/photo-1590071089561-89cf25d4ecbc?w=800&q=80',
  0, true
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'Africana Center: Heritage Night');


-- ============================================================
-- MIGRATION 00018: Event Ratings
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_reservations' AND column_name = 'rating') THEN
    ALTER TABLE public.event_reservations
      ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      ADD COLUMN feedback TEXT,
      ADD COLUMN rated_at TIMESTAMPTZ;
  END IF;
END $$;


-- ============================================================
-- MIGRATION 00019: Free Food Alert System
-- ============================================================

CREATE TABLE IF NOT EXISTS public.free_food_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  posted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  food_type TEXT NOT NULL DEFAULT 'other'
    CHECK (food_type IN ('pizza', 'sandwiches', 'snacks', 'drinks', 'baked_goods', 'fruit', 'full_meal', 'other')),
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  custom_location_detail TEXT,
  emoji TEXT DEFAULT '🍕',
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.free_food_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_food_active ON public.free_food_posts (is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_free_food_posted_by ON public.free_food_posts (posted_by);
CREATE INDEX IF NOT EXISTS idx_free_food_created ON public.free_food_posts (created_at DESC);

ALTER TABLE public.free_food_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_food_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "free_food_posts_select" ON public.free_food_posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_posts_insert" ON public.free_food_posts FOR INSERT WITH CHECK (auth.uid() = posted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_posts_update" ON public.free_food_posts FOR UPDATE USING (auth.uid() = posted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_posts_delete" ON public.free_food_posts FOR DELETE USING (auth.uid() = posted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_subs_select" ON public.free_food_subscriptions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_subs_insert" ON public.free_food_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "free_food_subs_delete" ON public.free_food_subscriptions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_free_food_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '2 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_free_food_expiry ON public.free_food_posts;
CREATE TRIGGER trg_set_free_food_expiry
  BEFORE INSERT ON public.free_food_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_free_food_expiry();

CREATE OR REPLACE FUNCTION public.notify_free_food_subscribers()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color, metadata)
  SELECT s.user_id, 'free_food', NEW.emoji, 'Free Food: ' || NEW.title,
    NEW.location_name || COALESCE(' - ' || NEW.custom_location_detail, ''),
    'free_food', '#22C55E',
    jsonb_build_object('post_id', NEW.id)
  FROM public.free_food_subscriptions s
  WHERE s.user_id != NEW.posted_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_free_food_subscribers ON public.free_food_posts;
CREATE TRIGGER trg_notify_free_food_subscribers
  AFTER INSERT ON public.free_food_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_free_food_subscribers();

CREATE OR REPLACE FUNCTION public.cleanup_expired_free_food()
RETURNS void AS $$
BEGIN
  UPDATE public.free_food_posts SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.free_food_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- MIGRATION 00020: Friend Groups, Event Invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.friend_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '👥',
  color TEXT DEFAULT '#6AADE4',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.friend_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_groups_owner ON public.friend_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_group ON public.friend_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_user ON public.friend_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_event ON public.event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_invitee ON public.event_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_inviter ON public.event_invitations(inviter_id);

ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own groups" ON public.friend_groups FOR SELECT USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create groups" ON public.friend_groups FOR INSERT WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own groups" ON public.friend_groups FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own groups" ON public.friend_groups FOR DELETE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Group owners can manage members" ON public.friend_group_members
    FOR ALL USING (EXISTS (SELECT 1 FROM public.friend_groups WHERE id = group_id AND owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can see groups they belong to" ON public.friend_group_members
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Inviters can create invitations" ON public.event_invitations
    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their invitations" ON public.event_invitations
    FOR SELECT USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Invitees can update invitation status" ON public.event_invitations
    FOR UPDATE USING (auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_event_invitation()
RETURNS trigger AS $$
DECLARE
  inviter_record record;
  event_record record;
BEGIN
  SELECT * INTO inviter_record FROM public.profiles WHERE id = NEW.inviter_id;
  SELECT * INTO event_record FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (NEW.invitee_id, 'event_invitation', COALESCE(event_record.icon, '🎪'),
    inviter_record.display_name || ' invited you!',
    'You''re invited to ' || event_record.title, 'social', '#6AADE4');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_invitation_created ON public.event_invitations;
CREATE TRIGGER on_event_invitation_created
  AFTER INSERT ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_invitation();

CREATE OR REPLACE FUNCTION public.handle_event_join()
RETURNS trigger AS $$
DECLARE
  event_record record;
  joiner_record record;
  is_friend boolean;
  notif_body text;
BEGIN
  SELECT * INTO event_record FROM public.events WHERE id = NEW.event_id;
  SELECT * INTO joiner_record FROM public.profiles WHERE id = NEW.user_id;
  IF event_record.created_by IS NOT NULL AND event_record.created_by != NEW.user_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships WHERE status = 'accepted'
        AND ((requester_id = NEW.user_id AND addressee_id = event_record.created_by)
          OR (requester_id = event_record.created_by AND addressee_id = NEW.user_id))
    ) INTO is_friend;
    IF is_friend THEN
      notif_body := 'Your friend ' || joiner_record.display_name || ' saved your event!';
    ELSE
      notif_body := 'Your event now has a new attendee!';
    END IF;
    INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
    VALUES (event_record.created_by, 'event_join', event_record.icon,
      joiner_record.display_name || ' joined ' || event_record.title, notif_body, 'event', event_record.color);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_reservation_created()
RETURNS trigger AS $$
DECLARE
  event_record record;
  reserver_record record;
  is_friend boolean;
  creator_body text;
BEGIN
  SELECT * INTO event_record FROM public.events WHERE id = NEW.event_id;
  SELECT * INTO reserver_record FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (NEW.user_id, 'reservation', '🎟️',
    CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP Confirmed!' ELSE 'Ticket Purchased!' END,
    'Your confirmation code is ' || NEW.confirmation_code, 'events', '#22C55E');
  IF event_record.created_by IS NOT NULL AND event_record.created_by != NEW.user_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships WHERE status = 'accepted'
        AND ((requester_id = NEW.user_id AND addressee_id = event_record.created_by)
          OR (requester_id = event_record.created_by AND addressee_id = NEW.user_id))
    ) INTO is_friend;
    IF is_friend THEN
      creator_body := 'Your friend ' || reserver_record.display_name || ' reserved a spot at ' || event_record.title || '!';
    ELSE
      creator_body := 'Someone reserved a spot at your event: ' || event_record.title;
    END IF;
    INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
    VALUES (event_record.created_by, 'new_reservation', '🎟️',
      'New ' || CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP' ELSE 'ticket purchase' END,
      creator_body, 'events', '#418FDE');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- MIGRATION 00021: Visibility and Account Types
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'student'
    CHECK (account_type IN ('student', 'club', 'staff'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'friends_only'));

CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);

CREATE OR REPLACE FUNCTION public.can_see_event(ev public.events)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE viewer_id uuid;
BEGIN
  IF ev.visibility = 'public' THEN RETURN TRUE; END IF;
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN RETURN FALSE; END IF;
  IF viewer_id = ev.created_by THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted'
    AND ((requester_id = viewer_id AND addressee_id = ev.created_by)
      OR (requester_id = ev.created_by AND addressee_id = viewer_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.event_invitations WHERE event_id = ev.id AND invitee_id = viewer_id) THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;

DO $$ BEGIN
  CREATE POLICY "Events visible based on visibility" ON public.events FOR SELECT
    USING (public.can_see_event(events));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_visibility_by_account_type()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creator_account_type text;
BEGIN
  SELECT account_type INTO creator_account_type FROM public.profiles WHERE id = NEW.created_by;
  IF creator_account_type IN ('club', 'staff') AND NEW.visibility = 'friends_only' THEN
    RAISE EXCEPTION 'Club and staff accounts cannot create friends-only events';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_visibility_by_account_type ON public.events;
CREATE TRIGGER enforce_event_visibility_by_account_type
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_visibility_by_account_type();

CREATE OR REPLACE FUNCTION public.get_friends_event_ids(
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS TABLE(id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE viewer_id uuid;
BEGIN
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT e.id FROM public.events e
  WHERE e.end_time >= now()
    AND (EXISTS (SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
        AND ((f.requester_id = viewer_id AND f.addressee_id = e.created_by)
          OR (f.requester_id = e.created_by AND f.addressee_id = viewer_id)))
      OR EXISTS (SELECT 1 FROM public.event_invitations ei WHERE ei.event_id = e.id AND ei.invitee_id = viewer_id))
    AND public.can_see_event(e)
  ORDER BY e.start_time ASC LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================================
-- MIGRATION 00022: Security Hardening
-- ============================================================

UPDATE public.profiles SET account_type = 'student' WHERE account_type IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, graduation_year, account_type, joined_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'graduation_year', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'account_type', ''), 'student'),
    to_char(now(), 'YYYY-MM-DD')
  );
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (NEW.id, 'welcome', 'Welcome to JumboNow!', 'Start exploring events and connecting with the Tufts community.');
  RETURN NEW;
END;
$$;


-- ============================================================
-- MIGRATION 00023: Group Chat, Event Sharing, Free Food Enhancements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL UNIQUE REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_conversation_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.free_food_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS public.free_food_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.free_food_posts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, requester_id)
);

ALTER TABLE public.group_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_food_requests ENABLE ROW LEVEL SECURITY;

-- Helper: check group membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.friend_group_members WHERE group_id = p_group_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.friend_groups WHERE id = p_group_id AND owner_id = p_user_id);
$$;

DO $$ BEGIN
  CREATE POLICY "Group conv visible to owner and members" ON public.group_conversations
    FOR SELECT USING (
      public.is_group_owner(group_id, auth.uid()) OR public.is_group_member(group_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Group conv insert by owner" ON public.group_conversations
    FOR INSERT WITH CHECK (public.is_group_owner(group_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Group conv update by owner or member" ON public.group_conversations
    FOR UPDATE USING (
      public.is_group_owner(group_id, auth.uid()) OR public.is_group_member(group_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Group messages visible to owner and members" ON public.group_messages
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.group_conversations gc
        WHERE gc.id = group_conversation_id
          AND (public.is_group_owner(gc.group_id, auth.uid()) OR public.is_group_member(gc.group_id, auth.uid()))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Group messages insert by owner or member" ON public.group_messages
    FOR INSERT WITH CHECK (
      auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_conversations gc
        WHERE gc.id = group_conversation_id
          AND (public.is_group_owner(gc.group_id, auth.uid()) OR public.is_group_member(gc.group_id, auth.uid()))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view groups they belong to" ON public.friend_groups
    FOR SELECT USING (public.is_group_member(id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Free food requests visible to poster and requester" ON public.free_food_requests
    FOR SELECT USING (auth.uid() = requester_id OR EXISTS (SELECT 1 FROM public.free_food_posts p WHERE p.id = post_id AND p.posted_by = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can request free food" ON public.free_food_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Poster can update request status" ON public.free_food_requests
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.free_food_posts p WHERE p.id = post_id AND p.posted_by = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_friend_group_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.group_conversations (group_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friend_group_created ON public.friend_groups;
CREATE TRIGGER on_friend_group_created
  AFTER INSERT ON public.friend_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_group_created();

INSERT INTO public.group_conversations (group_id)
SELECT id FROM public.friend_groups
WHERE id NOT IN (SELECT group_id FROM public.group_conversations);

CREATE INDEX IF NOT EXISTS idx_group_conversations_group ON public.group_conversations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_conversation ON public.group_messages(group_conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON public.group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_free_food_requests_post ON public.free_food_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_free_food_requests_requester ON public.free_food_requests(requester_id);

CREATE OR REPLACE FUNCTION public.handle_free_food_request()
RETURNS trigger AS $$
DECLARE post_record record; requester_record record;
BEGIN
  SELECT * INTO post_record FROM public.free_food_posts WHERE id = NEW.post_id;
  SELECT * INTO requester_record FROM public.profiles WHERE id = NEW.requester_id;
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (post_record.posted_by, 'free_food', post_record.emoji,
    requester_record.display_name || ' wants your food!',
    requester_record.display_name || ' requested to come for ' || post_record.title,
    'free_food', '#22C55E');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_free_food_request_created ON public.free_food_requests;
CREATE TRIGGER on_free_food_request_created
  AFTER INSERT ON public.free_food_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_free_food_request();

INSERT INTO storage.buckets (id, name, public)
VALUES ('free-food-images', 'free-food-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload food images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'free-food-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public can read food images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'free-food-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own food images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'free-food-images' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.free_food_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
