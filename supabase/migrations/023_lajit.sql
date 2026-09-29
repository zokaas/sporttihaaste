-- Lajit tauluun: ylläpito voi lisätä ja piilottaa lajeja Ylläpito-sivulla ilman koodimuutosta.
-- Mukana kauden alun lajit ja uudet: Kiipeily/boulderointi, Pilates, Soutu, Porrastreeni, Tanssi,
-- Vaellus (syke ylös), Salibandy, Koripallo, Lentopallo ja Laskettelu.
-- Iskun arvo tarkistetaan jatkossa tästä taulusta (sport_value). Nimeä ja arvoa ei voi muuttaa jälkikäteen,
-- jotta vanhat iskut pysyvät oikein. Lajia ei voi poistaa, mutta sen voi piilottaa.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

create table if not exists public.sports (
  name text primary key check (length(btrim(name)) between 2 and 40),
  value int not null check (value in (50, 100, 200)),
  category text not null check (category in ('Kestävyys', 'Voimailu', 'Palloilu', 'Muu')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sports enable row level security;
drop policy if exists "lajit näkyvät" on public.sports;
create policy "lajit näkyvät" on public.sports for select using (true);
drop policy if exists "ylläpito lisää lajeja" on public.sports;
create policy "ylläpito lisää lajeja" on public.sports for insert to authenticated with check (public.is_admin());
drop policy if exists "ylläpito muokkaa lajeja" on public.sports;
create policy "ylläpito muokkaa lajeja" on public.sports for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.sports to anon, authenticated, service_role;
grant insert, update on public.sports to authenticated, service_role;

create or replace function public.guard_sport() returns trigger
language plpgsql as $$
begin
  if new.name is distinct from old.name or new.value is distinct from old.value then
    raise exception 'Lajin nimeä ja arvoa ei voi muuttaa. Piilota laji ja lisää uusi.';
  end if;
  return new;
end $$;
drop trigger if exists sports_guard on public.sports;
create trigger sports_guard before update on public.sports
  for each row execute function public.guard_sport();

insert into public.sports (name, value, category) values
  ('Sali', 100, 'Voimailu'),
  ('Crossfit', 100, 'Voimailu'),
  ('Pump', 100, 'Voimailu'),
  ('Kehonpainotreeni', 100, 'Voimailu'),
  ('Kiipeily/boulderointi', 100, 'Voimailu'),
  ('Pilates', 100, 'Voimailu'),
  ('Juoksu', 100, 'Kestävyys'),
  ('Pyöräily', 100, 'Kestävyys'),
  ('Hiihto', 100, 'Kestävyys'),
  ('Uinti', 200, 'Kestävyys'),
  ('HIIT', 100, 'Kestävyys'),
  ('Spinning', 100, 'Kestävyys'),
  ('Soutu', 100, 'Kestävyys'),
  ('Porrastreeni', 100, 'Kestävyys'),
  ('Tanssi', 100, 'Kestävyys'),
  ('Vaellus (syke ylös)', 100, 'Kestävyys'),
  ('Tennis', 100, 'Palloilu'),
  ('Padel', 100, 'Palloilu'),
  ('Squash', 100, 'Palloilu'),
  ('Sulkapallo', 100, 'Palloilu'),
  ('Jalkapallo', 100, 'Palloilu'),
  ('Jääkiekko', 100, 'Palloilu'),
  ('Salibandy', 100, 'Palloilu'),
  ('Koripallo', 100, 'Palloilu'),
  ('Lentopallo', 100, 'Palloilu'),
  ('Kamppailulaji', 100, 'Muu'),
  ('Jooga', 50, 'Muu'),
  ('Liikkuvuus', 50, 'Muu'),
  ('Golf', 50, 'Muu'),
  ('Laskettelu', 50, 'Muu')
on conflict (name) do nothing;

-- Iskun arvo luetaan taulusta. Piilotetun lajin arvo säilyy, jotta vanhojen iskujen korjaus toimii.
create or replace function public.sport_value(s text) returns int
language sql stable security definer set search_path = public as $$
  select value from public.sports where name = s
$$;
