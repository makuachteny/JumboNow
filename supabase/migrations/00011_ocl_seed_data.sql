-- Phase 2: Seed OCL Events Data
-- Includes real events from TuftsTickets + campus events

-- Update existing 8 events with new OCL fields (if they exist from prior seed)
UPDATE public.events SET
  event_type = 'arts_culture', organizer_name = 'Hotung Cafe', organizer_icon = '🎤',
  ticket_price = 0, requires_reservation = true, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Open Mic Night';

UPDATE public.events SET
  event_type = 'sports', organizer_name = 'Tufts Recreation', organizer_icon = '🏀',
  ticket_price = 0, requires_reservation = true, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Pickup Basketball';

UPDATE public.events SET
  event_type = 'academic', organizer_name = 'Economics Department', organizer_icon = '📊',
  ticket_price = 0, requires_reservation = true, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Econ 101 Study Sprint';

UPDATE public.events SET
  event_type = 'student_org', organizer_name = 'Foodie Club', organizer_icon = '🍜',
  ticket_price = 0, requires_reservation = false, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Late Night Ramen Run';

UPDATE public.events SET
  event_type = 'outdoors', organizer_name = 'Tufts Wellness', organizer_icon = '🧘',
  ticket_price = 0, requires_reservation = true, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Yoga at the Rez';

UPDATE public.events SET
  event_type = 'arts_culture', organizer_name = 'Tufts Film Series', organizer_icon = '🎬',
  ticket_price = 0, requires_reservation = true, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Movie Night: Spirited Away';

UPDATE public.events SET
  event_type = 'arts_culture', organizer_name = 'Music Department', organizer_icon = '🎸',
  ticket_price = 0, requires_reservation = false, is_featured = false, ticket_types = '[]'::jsonb
WHERE title = 'Guitar Jam Session';

UPDATE public.events SET
  event_type = 'academic', organizer_name = 'JumboHacks', organizer_icon = '💻',
  ticket_price = 0, requires_reservation = true, is_featured = true, ticket_types = '[]'::jsonb
WHERE title = 'Hackathon Kickoff';

-- Insert REAL events from TuftsTickets (tuftstickets.com) — Feb 2026
INSERT INTO public.events (
  title, subtitle, description, icon, color, gradient_colors, category, location, distance,
  start_time, end_time, max_capacity, tags, energy, vibe,
  event_type, organizer_name, organizer_icon, ticket_price, requires_reservation, is_featured, ticket_types
) VALUES
(
  'CSSA: Lunar New Year Gala',
  'Chinese Students & Scholars Association',
  'Celebrate the Lunar New Year with the Chinese Students and Scholars Association! Enjoy performances, traditional food, and cultural festivities with the Tufts community.',
  '🏮', '#EF4444', '{"#EF4444","#DC2626","#B91C1C"}', 'General', 'Cohen Auditorium', '0.3 mi',
  '2026-02-08 18:00:00-05', '2026-02-08 22:00:00-05', 250,
  '{"Cultural","Free","Performance","Food"}', 88, '🎉 Festive',
  'student_org', 'CSSA', '🏮', 0, true, true,
  '[]'::jsonb
),
(
  'AAFRO: AAFROdisiac',
  'African American Fraternity & Sorority Council',
  'Join AAFRO for their annual Valentine''s Day celebration featuring incredible performances, music, and community. A beloved Tufts tradition.',
  '❤️', '#EC4899', '{"#EC4899","#DB2777","#BE185D"}', 'Arts', 'Sophia Gordon Hall Multipurpose Room', '0.4 mi',
  '2026-02-14 19:00:00-05', '2026-02-14 23:00:00-05', 200,
  '{"Performance","Valentine","Cultural","Free"}', 92, '🔥 Lit',
  'student_org', 'AAFRO', '🎭', 0, true, true,
  '[]'::jsonb
),
(
  'TUSC: After Hours - Senior Speakeasy',
  'Tufts University Social Collective',
  'An exclusive evening for Tufts seniors at the Joyce Cummings Center Ballroom. Dress code: cocktail attire. Drinks, music, and a night to remember.',
  '🍸', '#A78BFA', '{"#A78BFA","#8B5CF6","#7C3AED"}', 'General', 'Joyce Cummings Center Ballroom', '0.3 mi',
  '2026-02-20 20:00:00-05', '2026-02-21 00:00:00-05', 150,
  '{"Seniors Only","Social","Evening","Free"}', 85, '🍸 Classy',
  'student_org', 'TUSC', '🎉', 0, true, false,
  '[]'::jsonb
),
(
  'TUSC: Puppy Yoga!',
  'Tufts University Social Collective',
  'De-stress with adorable puppies while doing yoga! Limited spots available — RSVP early. Bring your own mat or borrow one.',
  '🐶', '#F472B6', '{"#F472B6","#EC4899","#DB2777"}', 'Sports', 'Curtis Hall Multipurpose Room', '0.2 mi',
  '2026-02-27 14:00:00-05', '2026-02-27 16:00:00-05', 60,
  '{"Wellness","Puppies","Free","Yoga"}', 80, '🐶 Adorable',
  'student_org', 'TUSC', '🐶', 0, true, true,
  '[]'::jsonb
),
(
  'TEDxTufts: Blueprints for the Future',
  'TEDxTufts',
  'Hear inspiring talks from students, faculty, and guest speakers about building the future. Ideas worth spreading, right here at Tufts. Light refreshments provided.',
  '🎤', '#EF4444', '{"#EF4444","#DC2626","#991B1B"}', 'Study', 'Cohen Auditorium', '0.3 mi',
  '2026-02-28 13:00:00-05', '2026-02-28 17:00:00-05', 300,
  '{"TEDx","Talks","Academic","Inspiring"}', 78, '🧠 Intellectual',
  'academic', 'TEDxTufts', '🎤', 6.50, true, false,
  '[{"name":"General","price":6.50,"available":300}]'::jsonb
),
(
  'Engineering for Women''s Health',
  'ENG4WH Conference',
  'A full-day conference exploring the intersection of engineering and women''s health. Features keynote speakers, panels, workshops, and networking opportunities.',
  '🔬', '#6366F1', '{"#6366F1","#4F46E5","#4338CA"}', 'Study', 'Joyce Cummings Center', '0.3 mi',
  '2026-03-20 09:00:00-04', '2026-03-20 17:00:00-04', 200,
  '{"Conference","Engineering","Health","Networking"}', 70, '💡 Innovative',
  'academic', 'ENG4WH', '🔬', 42.25, true, false,
  '[{"name":"General","price":42.25,"available":200}]'::jsonb
),
(
  'GSC: A Night Afloat - Boat Prom',
  'Graduate Student Council',
  'Graduate Student Council presents the annual Boat Prom! An unforgettable evening on the water with dinner, dancing, and Boston skyline views. Grads only.',
  '🚢', '#6AADE4', '{"#6AADE4","#418FDE","#3579C6"}', 'General', 'Ferry Terminal Building', '3 mi',
  '2026-04-17 19:00:00-04', '2026-04-18 00:00:00-04', 250,
  '{"Grad Students","Formal","Boat","Dancing"}', 95, '🔥 Lit',
  'student_org', 'GSC', '🎓', 32.00, true, false,
  '[{"name":"General","price":32.00,"available":250}]'::jsonb
),
-- Additional campus events
(
  'Spring Fling 2026',
  'Tufts Student Government',
  'The biggest event of the year! Live performances, food trucks, carnival games, and more. General admission includes all activities. VIP gets early entry and premium food.',
  '🎪', '#EC4899', '{"#EC4899","#F43F5E","#DC2626"}', 'General', 'Presidents Lawn', '0.2 mi',
  now() + interval '30 days', now() + interval '30 days' + interval '8 hours', 500,
  '{"Festival","Music","Food","Featured"}', 98, '🔥 Lit',
  'student_org', 'Tufts Student Government', '🐘', 25, true, true,
  '[{"name":"General","price":25,"available":400},{"name":"VIP","price":50,"available":100}]'::jsonb
),
(
  'Student Org Fair',
  'Student Activities Office',
  'Discover 200+ student organizations! From cultural clubs to academic societies, find your community at Tufts. Free swag and snacks at every table.',
  '🎯', '#6AADE4', '{"#6AADE4","#418FDE","#3579C6"}', 'General', 'Academic Quad', '0.2 mi',
  now() + interval '3 days', now() + interval '3 days' + interval '3 hours', 500,
  '{"Student Orgs","Club Fair","Free","All Students"}', 88, '🎯 Exciting',
  'student_org', 'Student Activities Office', '🎯', 0, true, true,
  '[]'::jsonb
),
(
  'Homecoming Football: Jumbos vs. Bates',
  'Tufts Athletics',
  'Cheer on the Jumbos at this year''s homecoming game! Tailgate starts 2 hours before kickoff. Student section included with Tufts ID.',
  '🏈', '#EF4444', '{"#EF4444","#DC2626","#B91C1C"}', 'Sports', 'Zimman Field', '0.5 mi',
  now() + interval '14 days', now() + interval '14 days' + interval '4 hours', 400,
  '{"Sports","Homecoming","Football","Tailgate"}', 95, '⚡ Electric',
  'sports', 'Tufts Athletics', '🏈', 5, true, false,
  '[{"name":"Student","price":5,"available":300},{"name":"General","price":15,"available":100}]'::jsonb
),
(
  'Blue Hills Hike',
  'Tufts Mountain Club',
  'Join us for a scenic hike at Blue Hills Reservation! Transportation provided from campus. Moderate difficulty, ~4 miles round trip. Bring water and snacks.',
  '⛰️', '#34D399', '{"#34D399","#10B981","#059669"}', 'Sports', 'Blue Hills Reservation', '12 mi',
  now() + interval '5 days', now() + interval '5 days' + interval '5 hours', 25,
  '{"Outdoors","Hiking","Nature","Transport Included"}', 75, '🌿 Adventurous',
  'outdoors', 'Tufts Mountain Club', '⛰️', 10, true, false,
  '[{"name":"General","price":10,"available":25}]'::jsonb
),
(
  'Campus Center Art Exhibition',
  'Tufts Art Gallery',
  'A curated exhibition featuring works by Tufts student artists across all media — painting, sculpture, photography, and digital art. Opening reception with refreshments.',
  '🎨', '#FACC15', '{"#FACC15","#F59E0B","#D97706"}', 'Arts', 'Aidekman Arts Center', '0.3 mi',
  now() + interval '7 days', now() + interval '7 days' + interval '3 hours', 100,
  '{"Art","Exhibition","Free","Reception"}', 55, '🎨 Creative',
  'campus_center', 'Tufts Art Gallery', '🎨', 0, true, false,
  '[]'::jsonb
);
