-- Monsterien HP voidaan asettaa käsin ylläpidon monsterieditorissa, kunnes monsteri paljastuu.
-- * hp_manual: käsin asetettu HP säilyy, vaikka tavoite lukittaisiin uudelleen.
-- * Paljastuneen monsterin HP:ta ei voi enää muuttaa (ei käsin eikä uudelleenlukituksella).
-- Aja Supabasen SQL-editorissa migraation 020 jälkeen. Turvallista ajaa uudelleen.

alter table public.monsters add column if not exists hp_manual boolean not null default false;

create or replace function public.guard_monster_hp() returns trigger
language plpgsql as $$
begin
  if new.hp is distinct from old.hp and old.revealed_at is not null and old.revealed_at <= now() then
    raise exception 'Monsteri on jo paljastunut, joten sen HP:ta ei voi enää muuttaa.';
  end if;
  return new;
end $$;

drop trigger if exists monsters_hp_guard on public.monsters;
create trigger monsters_hp_guard before update of hp on public.monsters
  for each row execute function public.guard_monster_hp();

-- Lukitus laskee HP:t kaavalla vain paljastumattomille monstereille, joiden HP:ta ei ole asetettu käsin.
create or replace function public.lock_season() returns public.season
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_pace numeric;
  s public.season;
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi lukita tavoitteen.'; end if;
  select coalesce(sum(pledge_hours), 0) into v_total from public.profiles where pledge_locked_at is not null;
  v_pace := v_total * 100 + 2750;
  update public.monsters set hp = case
      when week = 1 then round((4.0 / 7) * 1.2 * v_pace / 500) * 500
      when week = 12 then round(1.5 * v_pace / 500) * 500
      else round(v_pace * (1.05 + 0.1 * (week - 2) / 9.0) / 500) * 500
    end
  where (not hp_manual or hp is null) and (revealed_at is null or revealed_at > now());
  update public.season set total_pledge_hours = v_total, pace = round(v_pace),
    boss_hp = coalesce((select hp from public.monsters where week = 12), round(1.5 * v_pace / 500) * 500),
    hp_locked_at = now()
  where id = 1 returning * into s;
  return s;
end $$;
