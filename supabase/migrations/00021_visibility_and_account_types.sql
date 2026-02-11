-- 1a. Add account_type to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'student'
    CHECK (account_type IN ('student', 'club', 'staff'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);

-- 1b. Add visibility to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'friends_only'));

CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);

-- 1c. Create can_see_event() helper function
CREATE OR REPLACE FUNCTION public.can_see_event(ev public.events)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  viewer_id uuid;
BEGIN
  -- Public events are visible to everyone
  IF ev.visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Friends-only: must be authenticated
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Creator can always see their own event
  IF viewer_id = ev.created_by THEN
    RETURN TRUE;
  END IF;

  -- Check if viewer is an accepted friend of the creator
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = viewer_id AND addressee_id = ev.created_by)
        OR (requester_id = ev.created_by AND addressee_id = viewer_id)
      )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if viewer has been invited to the event
  IF EXISTS (
    SELECT 1 FROM public.event_invitations
    WHERE event_id = ev.id
      AND invitee_id = viewer_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 1d. Replace events SELECT RLS policy
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;

CREATE POLICY "Events visible based on visibility"
  ON public.events FOR SELECT
  USING (public.can_see_event(events));

-- 1e. Enforcement trigger: clubs/officials cannot create friends-only events
CREATE OR REPLACE FUNCTION public.enforce_visibility_by_account_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  creator_account_type text;
BEGIN
  SELECT account_type INTO creator_account_type
  FROM public.profiles
  WHERE id = NEW.created_by;

  IF creator_account_type IN ('club', 'staff') AND NEW.visibility = 'friends_only' THEN
    RAISE EXCEPTION 'Club and staff accounts cannot create friends-only events';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_event_visibility_by_account_type
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_visibility_by_account_type();

-- 1f. RPC function get_friends_event_ids()
CREATE OR REPLACE FUNCTION public.get_friends_event_ids(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  viewer_id uuid;
BEGIN
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT e.id
  FROM public.events e
  WHERE e.end_time >= now()
    AND (
      -- Events created by friends
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = viewer_id AND f.addressee_id = e.created_by)
            OR (f.requester_id = e.created_by AND f.addressee_id = viewer_id)
          )
      )
      -- Events the user was invited to
      OR EXISTS (
        SELECT 1 FROM public.event_invitations ei
        WHERE ei.event_id = e.id
          AND ei.invitee_id = viewer_id
      )
    )
    AND public.can_see_event(e)
  ORDER BY e.start_time ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
