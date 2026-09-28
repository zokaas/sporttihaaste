-- Koodikatselmoinnin korjaukset. Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

-- 1) Myöhästynyt ilmoittautuminen: lukitus koskee vain jo ilmoittautuneita (lupaus lukittu).
--    Ennen tätä uusi sankari ei voinut tallentaa nimeään ke 30.9. jälkeen lainkaan.
create or replace function public.guard_profile_lock() returns trigger
language plpgsql as $$
declare lock_at timestamptz;
begin
  select profile_lock_at into lock_at from public.season where id = 1;
  if now() > lock_at and old.pledge_locked_at is not null
     and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    if new.hero_name is distinct from old.hero_name
       or new.avatar_path is distinct from old.avatar_path
       or new.name_day is distinct from old.name_day
       or new.birthday is distinct from old.birthday
       or new.birth_year is distinct from old.birth_year
       or new.pledge_hours is distinct from old.pledge_hours
       or new.pledge_locked_at is distinct from old.pledge_locked_at then
      raise exception 'Ilmoittautuminen sulkeutui ke 30.9.';
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'Ylläpitäjäoikeutta ei voi muuttaa itse.';
  end if;
  return new;
end $$;

-- 2) Iskun arvot tarkistetaan tietokannassa, jotta iskuja ei voi väärentää ohittamalla sovelluksen.
--    Lajit ja arvot: sama lista kuin lib/rules.ts (SPORTS).
create or replace function public.sport_value(s text) returns int
language sql immutable as $$
  select case
    when s in ('Sali','Crossfit','Pump','Kehonpainotreeni','Juoksu','Pyöräily','Hiihto','HIIT','Spinning',
               'Tennis','Padel','Squash','Sulkapallo','Jalkapallo','Jääkiekko','Kamppailulaji') then 100
    when s = 'Uinti' then 200
    when s in ('Jooga','Liikkuvuus','Golf') then 50
  end
$$;

create or replace function public.guard_hit_values() returns trigger
language plpgsql as $$
declare
  v int := public.sport_value(new.sport);
  participants int := (select count(*) from public.profiles where pledge_locked_at is not null);
begin
  if v is null then raise exception 'Tuntematon laji.'; end if;
  if new.base <> round(new.minutes * v / 60.0) then raise exception 'Perusvahinko ei täsmää.'; end if;
  if new.bonus_pct not in (0, 50, 100, 150, 200) then raise exception 'Bonus ei kelpaa.'; end if;
  if new.damage <> round(new.base * (100 + new.bonus_pct) / 100.0) then raise exception 'Vahinko ei täsmää.'; end if;
  if new.user_id = any(new.companions) then raise exception 'Et voi olla oma seuralaisesi.'; end if;
  if new.all_together and cardinality(new.companions) + 1 < participants then
    raise exception 'Kaikki yhdessä vaatii kaikki sankarit seuralaisiksi.';
  end if;
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end $$;

drop trigger if exists hits_values on public.hits;
create trigger hits_values before insert or update on public.hits
  for each row execute function public.guard_hit_values();

-- 3) Muistutusten rajoitusta ei voi kiertää poistamalla omia muistutuksia.
drop policy if exists "omat muistutukset" on public.nudges;
drop policy if exists "omat muistutukset näkyvät" on public.nudges;
drop policy if exists "oma muistutus" on public.nudges;
create policy "omat muistutukset näkyvät" on public.nudges for select to authenticated using (sender = auth.uid());
create policy "oma muistutus" on public.nudges for insert to authenticated with check (sender = auth.uid());
