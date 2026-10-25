-- Päiväkirja: ylläpidon kirjoittamat päivittäiset tarinamerkinnät (esim. zombien päiväkirja Halloween-viikolla).
-- Merkintä näkyy pelaajille vasta omana päivänään, ja aamuajo lähettää siitä ilmoituksen.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
create table if not exists public.diary (
  day date primary key,
  title text,
  body text not null,
  updated_at timestamptz not null default now()
);
alter table public.diary enable row level security;
drop policy if exists "päiväkirja näkyy" on public.diary;
create policy "päiväkirja näkyy" on public.diary for select to authenticated using (day <= public.helsinki_today() or public.is_admin());
drop policy if exists "ylläpitäjä päiväkirja" on public.diary;
create policy "ylläpitäjä päiväkirja" on public.diary for all to authenticated using (public.is_admin()) with check (public.is_admin());
