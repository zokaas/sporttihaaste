-- "Koko porukka yhdessä" (+100 %) vaatii kaikki sinä päivänä terveet ilmoittautuneet, ei kipeitä.
-- Päivittää iskun tarkistuksen (migraatio 007). Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
create or replace function public.guard_hit_values() returns trigger
language plpgsql as $$
declare
  v int := public.sport_value(new.sport);
  healthy int := (
    select count(*) from public.profiles p
    where p.pledge_locked_at is not null
      and not exists (
        select 1 from public.sick_periods s
        where s.user_id = p.id and s.starts_on <= new.trained_on and (s.ends_on is null or s.ends_on >= new.trained_on)
      )
  );
begin
  if v is null then raise exception 'Tuntematon laji.'; end if;
  if new.base <> round(new.minutes * v / 60.0) then raise exception 'Perusvoima ei täsmää.'; end if;
  if new.bonus_pct not in (0, 50, 100, 150, 200) then raise exception 'Bonus ei kelpaa.'; end if;
  if new.damage <> round(new.base * (100 + new.bonus_pct) / 100.0) then raise exception 'Voima ei täsmää.'; end if;
  if new.user_id = any(new.companions) then raise exception 'Et voi olla oma seuralaisesi.'; end if;
  if new.all_together and cardinality(new.companions) + 1 < healthy then
    raise exception 'Koko porukka yhdessä vaatii kaikki terveet sankarit seuralaisiksi.';
  end if;
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end $$;
