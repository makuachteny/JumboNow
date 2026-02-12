-- ============================================================
-- MIGRATION 00024: Free Food Accept/Confirm Flow
-- Adds metadata to notifications, expands free_food_requests,
-- updates notify trigger, and adds notification cleanup trigger
-- ============================================================

-- 1A. Add metadata JSONB to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 1B. Expand free_food_requests columns
ALTER TABLE public.free_food_requests ADD COLUMN IF NOT EXISTS party_size INT NOT NULL DEFAULT 1;
ALTER TABLE public.free_food_requests ADD COLUMN IF NOT EXISTS eta TEXT;
ALTER TABLE public.free_food_requests ADD COLUMN IF NOT EXISTS dietary_notes TEXT;
ALTER TABLE public.free_food_requests ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

-- 1C. Update notify_free_food_subscribers trigger to include post_id in metadata
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

-- 1D. Trigger: clean up notifications when post is deactivated
CREATE OR REPLACE FUNCTION public.cleanup_free_food_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    DELETE FROM public.notifications
    WHERE type = 'free_food' AND metadata->>'post_id' = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_free_food_notifications ON public.free_food_posts;
CREATE TRIGGER trg_cleanup_free_food_notifications
  AFTER UPDATE ON public.free_food_posts
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_free_food_notifications();
