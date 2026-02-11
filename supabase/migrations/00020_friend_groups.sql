-- Friend Groups
CREATE TABLE IF NOT EXISTS public.friend_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '👥',
  color TEXT DEFAULT '#6AADE4',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Friend Group Members
CREATE TABLE IF NOT EXISTS public.friend_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Event Invitations
CREATE TABLE IF NOT EXISTS public.event_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, invitee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friend_groups_owner ON public.friend_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_group ON public.friend_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_user ON public.friend_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_event ON public.event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_invitee ON public.event_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_inviter ON public.event_invitations(inviter_id);

-- Enable RLS
ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: friend_groups (owner can CRUD)
CREATE POLICY "Users can view own groups" ON public.friend_groups
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create groups" ON public.friend_groups
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own groups" ON public.friend_groups
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own groups" ON public.friend_groups
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS: friend_group_members (group owner can manage, members can view)
CREATE POLICY "Group owners can manage members" ON public.friend_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.friend_groups WHERE id = group_id AND owner_id = auth.uid())
  );

CREATE POLICY "Users can see groups they belong to" ON public.friend_group_members
  FOR SELECT USING (user_id = auth.uid());

-- RLS: event_invitations
CREATE POLICY "Inviters can create invitations" ON public.event_invitations
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can view their invitations" ON public.event_invitations
  FOR SELECT USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

CREATE POLICY "Invitees can update invitation status" ON public.event_invitations
  FOR UPDATE USING (auth.uid() = invitee_id);

-- Trigger: notify invitee when invited to an event
CREATE OR REPLACE FUNCTION public.handle_event_invitation()
RETURNS trigger AS $$
DECLARE
  inviter_record record;
  event_record record;
BEGIN
  SELECT * INTO inviter_record FROM public.profiles WHERE id = NEW.inviter_id;
  SELECT * INTO event_record FROM public.events WHERE id = NEW.event_id;

  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  VALUES (
    NEW.invitee_id,
    'event_invitation',
    COALESCE(event_record.icon, '🎪'),
    inviter_record.display_name || ' invited you!',
    'You''re invited to ' || event_record.title,
    'social',
    '#6AADE4'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_event_invitation_created
  AFTER INSERT ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_invitation();

-- Enhanced: handle_event_join now checks if joiner is a friend
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
    -- Check if joiner is a friend of the event creator
    SELECT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = NEW.user_id AND addressee_id = event_record.created_by)
          OR (requester_id = event_record.created_by AND addressee_id = NEW.user_id)
        )
    ) INTO is_friend;

    IF is_friend THEN
      notif_body := 'Your friend ' || joiner_record.display_name || ' saved your event!';
    ELSE
      notif_body := 'Your event now has a new attendee!';
    END IF;

    INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
    VALUES (
      event_record.created_by,
      'event_join',
      event_record.icon,
      joiner_record.display_name || ' joined ' || event_record.title,
      notif_body,
      'event',
      event_record.color
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced: handle_reservation_created now checks if reserver is a friend
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

  -- Notify event creator with friend context
  IF event_record.created_by IS NOT NULL AND event_record.created_by != NEW.user_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = NEW.user_id AND addressee_id = event_record.created_by)
          OR (requester_id = event_record.created_by AND addressee_id = NEW.user_id)
        )
    ) INTO is_friend;

    IF is_friend THEN
      creator_body := 'Your friend ' || reserver_record.display_name || ' reserved a spot at ' || event_record.title || '!';
    ELSE
      creator_body := 'Someone reserved a spot at your event: ' || event_record.title;
    END IF;

    INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
    VALUES (
      event_record.created_by,
      'new_reservation',
      '🎟️',
      'New ' || CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP' ELSE 'ticket purchase' END,
      creator_body,
      'events',
      '#418FDE'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
