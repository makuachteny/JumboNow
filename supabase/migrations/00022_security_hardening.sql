-- 1. Enable RLS on achievements table (was missing)
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are readable by everyone (reference data)
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

-- Only service role can insert/update/delete achievements (no user modification)
-- No INSERT/UPDATE/DELETE policies = denied for all users via anon/authenticated roles

-- 2. Ensure all existing profiles have account_type = 'student'
-- (handles profiles created before the account_type column was added)
UPDATE public.profiles
  SET account_type = 'student'
  WHERE account_type IS NULL;

-- 3. Update handle_new_user() to read account_type from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, graduation_year, account_type, joined_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'graduation_year', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'account_type', ''),
      'student'
    ),
    to_char(now(), 'YYYY-MM-DD')
  );

  -- Send welcome notification
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'welcome',
    'Welcome to JumboNow!',
    'Start exploring events and connecting with the Tufts community.'
  );

  RETURN NEW;
END;
$$;
