-- Fix overly permissive notification insert policy
-- Previously: WITH CHECK (true) allowed any user to insert notifications for any other user
-- Now: Only allow inserting notifications for yourself, or via service role (server-side)

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
