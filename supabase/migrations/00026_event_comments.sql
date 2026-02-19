-- Event Comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_comments_user_id ON event_comments(user_id);

-- RLS
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY "Anyone can read event comments"
  ON event_comments FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert own comments"
  ON event_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON event_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
