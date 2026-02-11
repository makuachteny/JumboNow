-- Add rating columns to event_reservations for post-event feedback
ALTER TABLE event_reservations
  ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN feedback TEXT,
  ADD COLUMN rated_at TIMESTAMPTZ;
