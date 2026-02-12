-- ============================================================
-- Migration 00023: Group Chat, Event Sharing, Free Food Enhancements
-- ============================================================

-- 1A. Group Conversations table
CREATE TABLE IF NOT EXISTS public.group_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL UNIQUE REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1B. Group Messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_conversation_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 1C. Add metadata to existing messages table (for event shares in 1-on-1)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 1D. Add image_url to free_food_posts
ALTER TABLE public.free_food_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 1E. Free Food Requests table (accept/confirm flow)
CREATE TABLE IF NOT EXISTS public.free_food_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.free_food_posts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, requester_id)
);

-- Enable RLS
ALTER TABLE public.group_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_food_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1F. RLS Policies
-- ============================================================

-- group_conversations: SELECT by owner or member
CREATE POLICY "Group conv visible to owner and members" ON public.group_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.friend_groups fg WHERE fg.id = group_id AND fg.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.friend_group_members fgm WHERE fgm.group_id = group_conversations.group_id AND fgm.user_id = auth.uid())
  );

-- group_conversations: INSERT by group owner
CREATE POLICY "Group conv insert by owner" ON public.group_conversations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.friend_groups fg WHERE fg.id = group_id AND fg.owner_id = auth.uid())
  );

-- group_conversations: UPDATE by owner or member
CREATE POLICY "Group conv update by owner or member" ON public.group_conversations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.friend_groups fg WHERE fg.id = group_id AND fg.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.friend_group_members fgm WHERE fgm.group_id = group_conversations.group_id AND fgm.user_id = auth.uid())
  );

-- group_messages: SELECT by owner or member
CREATE POLICY "Group messages visible to owner and members" ON public.group_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_conversations gc
      JOIN public.friend_groups fg ON fg.id = gc.group_id
      WHERE gc.id = group_conversation_id
        AND (fg.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.friend_group_members fgm WHERE fgm.group_id = gc.group_id AND fgm.user_id = auth.uid()))
    )
  );

-- group_messages: INSERT by owner or member (must be sender)
CREATE POLICY "Group messages insert by owner or member" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.group_conversations gc
      JOIN public.friend_groups fg ON fg.id = gc.group_id
      WHERE gc.id = group_conversation_id
        AND (fg.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.friend_group_members fgm WHERE fgm.group_id = gc.group_id AND fgm.user_id = auth.uid()))
    )
  );

-- friend_groups: Add SELECT policy for members (currently only owner can SELECT)
CREATE POLICY "Members can view groups they belong to" ON public.friend_groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.friend_group_members fgm WHERE fgm.group_id = id AND fgm.user_id = auth.uid())
  );

-- free_food_requests: SELECT - poster can see requests on their posts, requester can see own
CREATE POLICY "Free food requests visible to poster and requester" ON public.free_food_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.free_food_posts p WHERE p.id = post_id AND p.posted_by = auth.uid())
  );

-- free_food_requests: INSERT - authenticated users can request
CREATE POLICY "Users can request free food" ON public.free_food_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- free_food_requests: UPDATE - poster can confirm/decline
CREATE POLICY "Poster can update request status" ON public.free_food_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.free_food_posts p WHERE p.id = post_id AND p.posted_by = auth.uid())
  );

-- ============================================================
-- 1G. Trigger: auto-create group_conversation on friend_group insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_friend_group_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.group_conversations (group_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friend_group_created
  AFTER INSERT ON public.friend_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_group_created();

-- ============================================================
-- 1H. Backfill existing groups + Indexes
-- ============================================================
INSERT INTO public.group_conversations (group_id)
SELECT id FROM public.friend_groups
WHERE id NOT IN (SELECT group_id FROM public.group_conversations);

CREATE INDEX IF NOT EXISTS idx_group_conversations_group ON public.group_conversations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_conversation ON public.group_messages(group_conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON public.group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_free_food_requests_post ON public.free_food_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_free_food_requests_requester ON public.free_food_requests(requester_id);

-- ============================================================
-- 1I. Trigger: notify poster when someone requests free food
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_free_food_request()
RETURNS trigger AS $$
DECLARE
  post_record record;
  requester_record record;
BEGIN
  SELECT * INTO post_record FROM public.free_food_posts WHERE id = NEW.post_id;
  SELECT * INTO requester_record FROM public.profiles WHERE id = NEW.requester_id;

  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (
    post_record.posted_by,
    'free_food',
    post_record.emoji,
    requester_record.display_name || ' wants your food!',
    requester_record.display_name || ' requested to come for ' || post_record.title,
    'free_food',
    '#22C55E'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_free_food_request_created
  AFTER INSERT ON public.free_food_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_free_food_request();

-- ============================================================
-- 1J. Storage bucket for free food images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('free-food-images', 'free-food-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users upload, public read, creator delete
CREATE POLICY "Authenticated users can upload food images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'free-food-images' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read food images"
ON storage.objects FOR SELECT
USING (bucket_id = 'free-food-images');

CREATE POLICY "Users can delete own food images"
ON storage.objects FOR DELETE
USING (bucket_id = 'free-food-images' AND auth.uid()::text = (storage.foldername(name))[1]);
