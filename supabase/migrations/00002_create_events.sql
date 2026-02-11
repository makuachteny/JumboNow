-- Events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  subtitle text,
  description text,
  icon text default '🎉',
  color text default '#22D3EE',
  gradient_colors text[] default '{"#22D3EE","#3B82F6","#6366F1"}',
  category text not null default 'General',
  location text,
  distance text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  max_capacity integer default 100,
  tags text[] default '{}',
  energy integer default 50,
  vibe text default '⚡ Active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

-- Event attendees junction table
create table public.event_attendees (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(event_id, user_id)
);
