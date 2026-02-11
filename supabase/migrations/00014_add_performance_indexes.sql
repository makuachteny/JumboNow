-- Performance indexes for common queries

-- Events: "upcoming events" queries filter by start_time
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events (start_time);

-- Events: category filter queries
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events (event_type);

-- Events: featured events queries
CREATE INDEX IF NOT EXISTS idx_events_is_featured ON public.events (is_featured) WHERE is_featured = true;

-- Profiles: username search
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Event attendees: counting attendees per event
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON public.event_attendees (event_id);

-- Event reservations: looking up by event + user (common pattern)
CREATE INDEX IF NOT EXISTS idx_reservations_event_user ON public.event_reservations (event_id, user_id);
