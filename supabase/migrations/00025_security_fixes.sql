-- Migration 00025: Security fixes from comprehensive audit
-- 1. Prevent self-friendships
-- 2. Make confirmation_code unique on event_reservations
-- 3. Restrict search_logs to own logs only

-- 1. Add self-friendship prevention constraint
ALTER TABLE public.friendships
ADD CONSTRAINT check_no_self_friend CHECK (requester_id != addressee_id);

-- 2. Add UNIQUE constraint to confirmation_code (only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_confirmation_code
ON public.event_reservations (confirmation_code)
WHERE confirmation_code IS NOT NULL;

-- 3. Fix search_logs visibility - restrict to own logs only
DROP POLICY IF EXISTS "Users can view search logs" ON public.search_logs;
CREATE POLICY "Users can view own search logs"
ON public.search_logs FOR SELECT
USING (auth.uid() = user_id);
