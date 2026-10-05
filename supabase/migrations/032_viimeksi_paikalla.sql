-- Viimeksi paikalla: jokaisen sankarin viimeisin käynti sovelluksessa (päivittyy korkeintaan kerran 15 minuutissa).
-- Näkyy vain ylläpitäjälle. Katso Supabasen SQL-editorissa: select * from public.viimeksi_paikalla;
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

create table if not exists public.last_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.last_seen enable row level security;
drop policy if exists "ylläpito näkee käynnit" on public.last_seen;
create policy "ylläpito näkee käynnit" on public.last_seen for select to authenticated using (public.is_admin());

-- Sovellus kutsuu tätä sivua ladatessa. Kirjoittaa vain oman rivin, ja vain jos edellisestä on yli 15 min.
create or replace function public.touch_last_seen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.last_seen (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at
  where public.last_seen.seen_at < now() - interval '15 minutes';
end $$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Luettava lista (Suomen aika). security_invoker: noudattaa taulun RLS:ää, joten vain ylläpitäjä näkee rivit.
create or replace view public.viimeksi_paikalla with (security_invoker = true) as
  select p.hero_name as sankari,
         to_char(l.seen_at at time zone 'Europe/Helsinki', 'DD.MM. HH24:MI') as viimeksi,
         now() - l.seen_at as aikaa_sitten
  from public.last_seen l
  join public.profiles p on p.id = l.user_id
  order by l.seen_at desc;
revoke all on public.viimeksi_paikalla from anon;
