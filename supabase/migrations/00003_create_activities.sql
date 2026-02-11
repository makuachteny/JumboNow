-- Activities table
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  activity_type text not null default 'Chill',
  type_icon text default '☕',
  text text not null,
  location text,
  distance text,
  mood text default 'Social',
  is_active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger activities_updated_at
  before update on public.activities
  for each row execute function public.handle_updated_at();

-- Activity engagements junction table
create table public.activity_engagements (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(activity_id, user_id)
);
