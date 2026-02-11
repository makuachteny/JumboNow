-- Seed data for testing (run after creating a test user via the app)
-- Replace USER_ID_HERE with the actual user ID from auth.users after registration

-- Sample events
insert into public.events (title, subtitle, description, icon, color, gradient_colors, category, location, distance, start_time, end_time, max_capacity, tags, energy, vibe) values
(
  'Open Mic Night',
  'Hotung Cafe Presents',
  'Showcase your talent in our intimate venue. Poetry, music, comedy - all forms of expression welcome. Professional sound system and lighting.',
  '🎤', '#FF3B5C', '{"#EC4899","#F43F5E","#DC2626"}', 'Arts', 'Hotung Cafe', '0.3 mi',
  now() + interval '2 hours', now() + interval '5 hours', 80,
  '{"Music","Performance","Free Food","Late Night"}', 95, '🔥 Lit'
),
(
  'Pickup Basketball',
  'All Skill Levels',
  'Competitive but friendly pickup games. Bring your A-game and good vibes. We''ll split into teams based on skill level.',
  '🏀', '#00D9FF', '{"#22D3EE","#3B82F6","#6366F1"}', 'Sports', 'Cousens Gym', '0.5 mi',
  now() + interval '1 hour', now() + interval '3 hours', 20,
  '{"Active","Competitive","Social","Beginner Friendly"}', 88, '⚡ High Energy'
),
(
  'Econ 101 Study Sprint',
  'Midterm Prep Session',
  'Collaborative study session for upcoming midterm. We''ll cover supply/demand, elasticity, and market structures. Pizza arrives at 10pm.',
  '📊', '#A78BFA', '{"#A78BFA","#8B5CF6","#D946EF"}', 'Study', 'Tisch Library - Level 3', '0.2 mi',
  now() + interval '3 hours', now() + interval '6 hours', 15,
  '{"Academic","Food Included","Focused","Group Study"}', 65, '🧠 Focused'
),
(
  'Late Night Ramen Run',
  'Davis Square Adventure',
  'Post-study comfort food expedition. Meeting at Campus Center at 10:15, walking together to Davis. Split bills, share appetizers.',
  '🍜', '#FACC15', '{"#FACC15","#F97316","#EF4444"}', 'Food', 'Momogoose', '0.8 mi',
  now() + interval '5 hours', now() + interval '7 hours', 12,
  '{"Food","Night Owl","Walking","Social"}', 45, '🌙 Chill'
),
(
  'Yoga at the Rez',
  'Morning Flow Session',
  'Start your day with a peaceful yoga session on the beautiful Rez Quad. All levels welcome. Bring your own mat.',
  '🧘', '#34D399', '{"#34D399","#10B981","#059669"}', 'Sports', 'Rez Quad', '0.4 mi',
  now() + interval '12 hours', now() + interval '13 hours', 30,
  '{"Wellness","Outdoor","Beginner Friendly"}', 40, '🧘 Peaceful'
),
(
  'Movie Night: Spirited Away',
  'Tufts Film Series',
  'Enjoy a screening of Studio Ghibli''s masterpiece. Free popcorn and drinks provided.',
  '🎬', '#EC4899', '{"#EC4899","#DB2777","#BE185D"}', 'Arts', 'Barnum 008', '0.3 mi',
  now() + interval '4 hours', now() + interval '6 hours', 50,
  '{"Film","Anime","Free"}', 60, '🍿 Cozy'
),
(
  'Guitar Jam Session',
  'Bring Your Instrument',
  'Casual jam session for guitar players of all levels. Learn new songs, share licks, and have fun.',
  '🎸', '#F97316', '{"#F97316","#EA580C","#C2410C"}', 'Arts', 'Granoff Music Center', '0.5 mi',
  now() - interval '1 hour', now() + interval '2 hours', 12,
  '{"Music","Jam","Social"}', 75, '🎵 Groovy'
),
(
  'Hackathon Kickoff',
  'JumboHacks 2025',
  '24-hour hackathon with prizes, mentors, and free food all night. Form teams of 2-4.',
  '💻', '#6366F1', '{"#6366F1","#4F46E5","#4338CA"}', 'Study', 'SEC Atrium', '0.6 mi',
  now() + interval '24 hours', now() + interval '48 hours', 100,
  '{"Tech","Coding","Prizes"}', 90, '💡 Innovative'
);

-- Sample activities
insert into public.activities (activity_type, type_icon, text, location, distance, mood) values
(
  'Food', '🍕',
  'Getting dinner at Dewick in 20 min! Looking for 2-3 people to join our table. We''re fun I promise 😄',
  'Dewick Dining', '0.1 mi', 'Hungry & Social'
),
(
  'Chill', '☕',
  'Grinding CS homework at Starbucks Davis. Come vibe and we can complain about p-sets together ☕💻',
  'Starbucks - Davis Sq', '0.7 mi', 'Focused but Social'
),
(
  'Explore', '🚶',
  'Target run for dorm supplies. Company would be amazing! Can also stop at Trader Joe''s if anyone needs snacks 🛒',
  'Walking from Campus', 'Starting now', 'Productive'
),
(
  'Gaming', '🎮',
  'Mario Kart 8 tournament in West Hall common room starting NOW. Bracket style, winner gets bragging rights + leftover Halloween candy 🏆',
  'West Hall - Floor 2', '0.4 mi', 'Competitive'
);
