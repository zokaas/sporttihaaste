-- Syntymävuosi. Aja Supabasen SQL-editorissa, jos schema.sql on ajettu ennen tätä muutosta.
alter table public.profiles
  add column if not exists birth_year smallint check (birth_year between 1900 and 2100);

-- Lukitus koskee myös syntymävuotta.
create or replace function public.guard_profile_lock() returns trigger
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
