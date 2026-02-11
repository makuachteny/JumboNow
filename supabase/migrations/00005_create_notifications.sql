-- Notifications table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null default 'system',
  icon text default '🔔',
  title text not null,
  body text,
  category text default 'system',
  color text default '#22D3EE',
  read boolean default false,
  created_at timestamptz default now()
);

-- Index for faster notification lookups
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, read);

-- Device tokens for push notifications
create table public.device_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz default now(),
  unique(user_id, token)
);
