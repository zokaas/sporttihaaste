-- Fairy Garden: aja kerran Supabasen SQL Editorissa.
create table if not exists public.fairies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.steps (
  fairy_id uuid not null references public.fairies(id) on delete cascade,
  day date not null,
  steps integer not null check (steps >= 0 and steps <= 200000),
  updated_at timestamptz not null default now(),
  primary key (fairy_id, day)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  fairy_id uuid not null references public.fairies(id) on delete cascade,
  day date not null,
  sport text not null,
  minutes integer not null check (minutes > 0 and minutes <= 600),
  created_at timestamptz not null default now()
);

-- Palvelin käyttää service_role-avainta. Suljetaan suora pääsy selaimesta.
alter table public.fairies enable row level security;
alter table public.steps enable row level security;
alter table public.workouts enable row level security;
