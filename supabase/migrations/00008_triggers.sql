-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, display_name, graduation_year, joined_date)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'graduation_year', ''),
    to_char(now(), 'Mon YYYY')
  );

  -- Send welcome notification
  insert into public.notifications (user_id, type, icon, title, body, category, color)
  values (
    new.id,
    'system',
    '🐘',
    'Welcome to JumboNow!',
    'Start discovering events and connecting with fellow Jumbos. Your campus adventure begins now.',
    'system',
    '#22D3EE'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Notify event creator when someone joins their event
create or replace function public.handle_event_join()
returns trigger as $$
declare
  event_record record;
  joiner_record record;
begin
  select * into event_record from public.events where id = new.event_id;
  select * into joiner_record from public.profiles where id = new.user_id;

  if event_record.created_by is not null and event_record.created_by != new.user_id then
    insert into public.notifications (user_id, type, icon, title, body, category, color)
    values (
      event_record.created_by,
      'event_join',
      event_record.icon,
      joiner_record.display_name || ' joined ' || event_record.title,
      'Your event now has a new attendee!',
      'event',
      event_record.color
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_event_attendee_added
  after insert on public.event_attendees
  for each row execute function public.handle_event_join();

-- Notify user when they receive a friend request
create or replace function public.handle_friend_request()
returns trigger as $$
declare
  requester_record record;
begin
  select * into requester_record from public.profiles where id = new.requester_id;

  insert into public.notifications (user_id, type, icon, title, body, category, color)
  values (
    new.addressee_id,
    'friend_request',
    '🤝',
    'New connection request',
    requester_record.display_name || ' wants to connect with you.',
    'social',
    '#C084FC'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_friend_request_sent
  after insert on public.friendships
  for each row execute function public.handle_friend_request();

-- Notify requester when friend request is accepted
create or replace function public.handle_friend_accepted()
returns trigger as $$
declare
  accepter_record record;
begin
  if new.status = 'accepted' and old.status = 'pending' then
    select * into accepter_record from public.profiles where id = new.addressee_id;

    insert into public.notifications (user_id, type, icon, title, body, category, color)
    values (
      new.requester_id,
      'friend_accepted',
      '🎉',
      accepter_record.display_name || ' accepted your request!',
      'You are now connected. Go say hi!',
      'social',
      '#22D3EE'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_friend_request_accepted
  after update on public.friendships
  for each row execute function public.handle_friend_accepted();
