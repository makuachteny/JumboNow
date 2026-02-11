-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  email text,
  bio text default '',
  graduation_year text,
  avatar_url text,
  avatar_color text default '#22D3EE',
  is_verified boolean default false,
  joined_date text,
  events_attended integer default 0,
  activities_created integer default 0,
  vibe_score integer default 50,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
