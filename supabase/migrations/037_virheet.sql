-- Virheloki: palvelin kirjaa tänne kaatumiset (kirjaus, taustatehtävät, ajastukset ja selaimen virheet),
-- ja ylläpito näkee ne ylläpidon Nyt-välilehdellä. Kirjoitus vain palvelinavaimella; ylläpitäjä voi lukea ja tyhjentää.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
create table if not exists public.error_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  source text not null,
  message text not null,
  detail text,
  path text,
  user_id uuid
);
create index if not exists error_log_at on public.error_log (at desc);
alter table public.error_log enable row level security;

drop policy if exists "virheet ylläpidolle" on public.error_log;
create policy "virheet ylläpidolle" on public.error_log for select to authenticated using (public.is_admin());
drop policy if exists "virheiden tyhjennys ylläpidolle" on public.error_log;
create policy "virheiden tyhjennys ylläpidolle" on public.error_log for delete to authenticated using (public.is_admin());
