-- ============================================================
-- Free Food Alert System
-- ============================================================

-- Core posts table
CREATE TABLE public.free_food_posts (
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

-- Subscription table for alert opt-in
CREATE TABLE public.free_food_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────
CREATE INDEX idx_free_food_active ON public.free_food_posts (is_active, expires_at);
CREATE INDEX idx_free_food_posted_by ON public.free_food_posts (posted_by);
CREATE INDEX idx_free_food_created ON public.free_food_posts (created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.free_food_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_food_subscriptions ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can read
CREATE POLICY "free_food_posts_select" ON public.free_food_posts
  FOR SELECT USING (true);

-- Posts: authenticated users can insert their own
CREATE POLICY "free_food_posts_insert" ON public.free_food_posts
  FOR INSERT WITH CHECK (auth.uid() = posted_by);

-- Posts: creator can update their own
CREATE POLICY "free_food_posts_update" ON public.free_food_posts
  FOR UPDATE USING (auth.uid() = posted_by);

-- Posts: creator can delete their own
CREATE POLICY "free_food_posts_delete" ON public.free_food_posts
  FOR DELETE USING (auth.uid() = posted_by);

-- Subscriptions: users read own
CREATE POLICY "free_food_subs_select" ON public.free_food_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: users insert own
CREATE POLICY "free_food_subs_insert" ON public.free_food_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions: users delete own
CREATE POLICY "free_food_subs_delete" ON public.free_food_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Auto-set expiry trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_free_food_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '2 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_free_food_expiry
  BEFORE INSERT ON public.free_food_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_free_food_expiry();

-- ─── Notify subscribers trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_free_food_subscribers()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  SELECT
    s.user_id,
    'free_food',
    NEW.emoji,
    'Free Food: ' || NEW.title,
    NEW.location_name || COALESCE(' - ' || NEW.custom_location_detail, ''),
    'free_food',
    '#22C55E'
  FROM public.free_food_subscriptions s
  WHERE s.user_id != NEW.posted_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_free_food_subscribers
  AFTER INSERT ON public.free_food_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_free_food_subscribers();

-- ─── Cleanup expired posts function ────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_free_food()
RETURNS void AS $$
BEGIN
  UPDATE public.free_food_posts
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Enable realtime ────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_food_posts;
