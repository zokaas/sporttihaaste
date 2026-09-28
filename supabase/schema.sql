-- Monsterijahti – Supabase-skeema. Aja kokonaisuudessaan Supabasen SQL-editorissa.

-- ---------- Profiilit ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  hero_name text unique check (char_length(hero_name) between 2 and 20),
  avatar_path text,
  name_day text check (name_day ~ '^\d{2}-\d{2}$'),      -- KK-PP
  birthday text check (birthday ~ '^\d{2}-\d{2}$'),      -- KK-PP
  birth_year smallint check (birth_year between 1900 and 2100),
  pledge_hours numeric(3,1) check (pledge_hours between 1 and 15),
  pledge_locked_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Profiili luodaan automaattisesti kirjautumisen yhteydessä
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Kausi ----------
create table public.season (
  id int primary key default 1 check (id = 1),
  profile_lock_at timestamptz not null default '2026-09-30 23:59:59+03',
  starts_on date not null default '2026-10-01',
  ends_on date not null default '2026-12-20',
  total_pledge_hours numeric,
  pace int,
  boss_hp int,
  hp_locked_at timestamptz
);
insert into public.season default values;

-- Nimi, kuva, juhlapäivät ja lupaus lukittuvat ke 30.9. Lupausta muutetaan kauden aikana muualla.
create function public.guard_profile_lock() returns trigger
language plpgsql as $$
declare lock_at timestamptz;
begin
  select profile_lock_at into lock_at from public.season where id = 1;
  if now() > lock_at and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    if new.hero_name is distinct from old.hero_name
       or new.avatar_path is distinct from old.avatar_path
       or new.name_day is distinct from old.name_day
       or new.birthday is distinct from old.birthday
       or new.birth_year is distinct from old.birth_year
       or new.pledge_hours is distinct from old.pledge_hours then
      raise exception 'Ilmoittautuminen sulkeutui ke 30.9.';
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'Ylläpitäjäoikeutta ei voi muuttaa itse.';
  end if;
  return new;
end $$;
create trigger profiles_lock before update on public.profiles
  for each row execute function public.guard_profile_lock();

-- ---------- Monsterit ----------
create table public.monsters (
  week int primary key check (week between 1 and 11),
  name text,
  description text,
  weakness text check (weakness in ('Kestävyys','Voimailu','Palloilu','Muu')),
  hp int,
  image_path text,
  revealed_at timestamptz
  -- parts (monsterikolmikko): migrations/009_kolmikko.sql
);
insert into public.monsters (week) select generate_series(1, 11);
update public.monsters set name = 'Willa Rykman' where week = 1;

-- Muille näkyy nimi, kuvaus ja kuva vasta paljastuksen jälkeen. HP ja viikko näkyvät aina.
-- Paljastus on automaattinen: revealed_at asetetaan tiedostossa migrations/002_kausi.sql.
create view public.monsters_public as
select week, hp,
  case when revealed_at <= now() then name end as name,
  case when revealed_at <= now() then description end as description,
  case when revealed_at <= now() then weakness end as weakness,
  case when revealed_at <= now() then image_path end as image_path,
  revealed_at
from public.monsters;

-- ---------- Kauden kirjaukset (vaihe 2) ----------
create table public.hits (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  trained_on date not null,
  sport text not null,
  minutes int not null check (minutes between 15 and 600),
  companions uuid[] not null default '{}',
  base int not null,
  bonus_pct int not null,
  damage int not null,
  all_together boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.step_days (
  user_id uuid references public.profiles on delete cascade,
  day date,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table public.sick_periods (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  starts_on date not null,
  ends_on date
);
create table public.pledge_changes (
  user_id uuid references public.profiles on delete cascade,
  from_week int check (from_week between 2 and 11),
  hours numeric(3,1) not null check (hours between 1 and 15),
  primary key (user_id, from_week)
);
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Oikeudet ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

alter table public.profiles enable row level security;
alter table public.season enable row level security;
alter table public.monsters enable row level security;
alter table public.hits enable row level security;
alter table public.step_days enable row level security;
alter table public.sick_periods enable row level security;
alter table public.pledge_changes enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "kaikki näkevät sankarit" on public.profiles for select to authenticated using (true);
create policy "oma profiili" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "ylläpitäjä profiilit" on public.profiles for update to authenticated using (public.is_admin());

create policy "kausi näkyy" on public.season for select to authenticated using (true);
create policy "ylläpitäjä kausi" on public.season for update to authenticated using (public.is_admin());

create policy "monsterit ylläpitäjälle" on public.monsters for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Muut lukevat monsterit näkymästä monsters_public, joka piilottaa paljastamattomat tiedot.
grant select on public.monsters_public to authenticated;

create policy "iskut näkyvät" on public.hits for select to authenticated using (true);
create policy "omat iskut" on public.hits for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "askeleet näkyvät" on public.step_days for select to authenticated using (true);
create policy "omat askeleet" on public.step_days for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sairaudet näkyvät" on public.sick_periods for select to authenticated using (true);
create policy "oma sairaus" on public.sick_periods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lupausmuutokset näkyvät" on public.pledge_changes for select to authenticated using (true);
create policy "oma lupausmuutos" on public.pledge_changes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "oma push" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ylläpitäjä näkee pushit" on public.push_subscriptions for select to authenticated using (public.is_admin());

-- ---------- Tavoitteen lukitus (sama kaava kuin lib/rules.ts: seasonHp) ----------
-- Korjattu versio: migrations/008_lukitus.sql
create function public.lock_season() returns public.season
language plpgsql security definer set search_path = public as $$
declare
  total numeric;
  pace numeric;
  s public.season;
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi lukita tavoitteen.'; end if;
  select coalesce(sum(pledge_hours), 0) into total from public.profiles where pledge_locked_at is not null;
  pace := total * 100 * 1.2 + 2750;
  update public.monsters set hp = round(0.8 * pace * 11 / 7 / 500) * 500 where week = 1;
  update public.monsters set hp = round(pace * (0.82 + 0.18 * (week - 2) / 8.0) / 500) * 500 where week between 2 and 10;
  update public.monsters set hp = round(1.5 * pace / 500) * 500 where week = 11;
  update public.season set total_pledge_hours = total, pace = round(pace),
    boss_hp = round(1.5 * pace / 500) * 500, hp_locked_at = now()
  where id = 1 returning * into s;
  return s;
end $$;

-- ---------- Profiilikuvat ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "oma kuva" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
insert into storage.buckets (id, name, public) values ('monsters', 'monsters', true);
create policy "monsterikuvat ylläpitäjälle" on storage.objects for all to authenticated
  using (bucket_id = 'monsters' and public.is_admin())
  with check (bucket_id = 'monsters' and public.is_admin());

-- Kauden viikot, lukitukset ja paljastusajat: aja myös tiedostot kansiosta migrations/ numerojärjestyksessä.
