-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.activities enable row level security;
alter table public.activity_engagements enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;

-- PROFILES
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- EVENTS
create policy "Events are viewable by everyone"
  on public.events for select using (true);

create policy "Authenticated users can create events"
  on public.events for insert with check (auth.uid() = created_by);

create policy "Event creators can update their events"
  on public.events for update using (auth.uid() = created_by);

create policy "Event creators can delete their events"
  on public.events for delete using (auth.uid() = created_by);

-- EVENT ATTENDEES
create policy "Event attendees are viewable by everyone"
  on public.event_attendees for select using (true);

create policy "Authenticated users can join events"
  on public.event_attendees for insert with check (auth.uid() = user_id);

create policy "Users can leave events"
  on public.event_attendees for delete using (auth.uid() = user_id);

-- ACTIVITIES
create policy "Activities are viewable by everyone"
  on public.activities for select using (true);

create policy "Authenticated users can create activities"
  on public.activities for insert with check (auth.uid() = created_by);

create policy "Activity creators can update their activities"
  on public.activities for update using (auth.uid() = created_by);

create policy "Activity creators can delete their activities"
  on public.activities for delete using (auth.uid() = created_by);

-- ACTIVITY ENGAGEMENTS
create policy "Activity engagements are viewable by everyone"
  on public.activity_engagements for select using (true);

create policy "Authenticated users can join activities"
  on public.activity_engagements for insert with check (auth.uid() = user_id);

create policy "Users can leave activities"
  on public.activity_engagements for delete using (auth.uid() = user_id);

-- FRIENDSHIPS
create policy "Users can see their own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Authenticated users can send friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);

create policy "Users can update friendships they're part of"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete friendships they're part of"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- NOTIFICATIONS
create policy "Users can see their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete using (auth.uid() = user_id);

create policy "System can insert notifications"
  on public.notifications for insert with check (true);

-- DEVICE TOKENS
create policy "Users can manage their own device tokens"
  on public.device_tokens for all using (auth.uid() = user_id);
