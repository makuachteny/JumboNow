-- Get attendee count for an event
create or replace function public.get_attendee_count(event_uuid uuid)
returns integer as $$
  select count(*)::integer from public.event_attendees where event_id = event_uuid;
$$ language sql stable;

-- Get mutual friends count between two users
create or replace function public.get_mutual_friends_count(user_a uuid, user_b uuid)
returns integer as $$
  select count(*)::integer from (
    select case
      when requester_id = user_a then addressee_id
      else requester_id
    end as friend_id
    from public.friendships
    where status = 'accepted'
      and (requester_id = user_a or addressee_id = user_a)
    intersect
    select case
      when requester_id = user_b then addressee_id
      else requester_id
    end as friend_id
    from public.friendships
    where status = 'accepted'
      and (requester_id = user_b or addressee_id = user_b)
  ) mutual;
$$ language sql stable;

-- Deactivate old activities (older than 24 hours)
create or replace function public.cleanup_old_activities()
returns void as $$
begin
  update public.activities
  set is_active = false
  where is_active = true
    and created_at < now() - interval '24 hours';
end;
$$ language plpgsql;

-- Get friend count for a user
create or replace function public.get_friend_count(user_uuid uuid)
returns integer as $$
  select count(*)::integer
  from public.friendships
  where status = 'accepted'
    and (requester_id = user_uuid or addressee_id = user_uuid);
$$ language sql stable;
