-- Update existing events and defaults from cyan (#22D3EE) to Tufts Blue (#6AADE4)

-- Update events with old cyan colors
UPDATE public.events SET
  color = '#6AADE4',
  gradient_colors = '{"#6AADE4","#418FDE","#3579C6"}'
WHERE color = '#22D3EE' OR color = '#00D9FF';

-- Update default avatar color in profiles
ALTER TABLE public.profiles ALTER COLUMN avatar_color SET DEFAULT '#6AADE4';
UPDATE public.profiles SET avatar_color = '#6AADE4' WHERE avatar_color = '#22D3EE';

-- Update default color in events table
ALTER TABLE public.events ALTER COLUMN color SET DEFAULT '#6AADE4';
ALTER TABLE public.events ALTER COLUMN gradient_colors SET DEFAULT '{"#6AADE4","#418FDE","#3579C6"}';

-- Update default color in notifications table
ALTER TABLE public.notifications ALTER COLUMN color SET DEFAULT '#6AADE4';
UPDATE public.notifications SET color = '#6AADE4' WHERE color = '#22D3EE';

-- Update the trigger to use new color
CREATE OR REPLACE FUNCTION public.handle_reservation_created()
RETURNS trigger AS $$
BEGIN
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

  INSERT INTO public.notifications (user_id, type, icon, title, body, category, color)
  SELECT
    e.created_by,
    'new_reservation',
    '🎟️',
    'New ' || CASE WHEN NEW.reservation_type = 'free_rsvp' THEN 'RSVP' ELSE 'ticket purchase' END,
    'Someone reserved a spot at your event: ' || e.title,
    'events',
    '#418FDE'
  FROM public.events e
  WHERE e.id = NEW.event_id AND e.created_by IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
