-- Viikon tsemppari: äänestys sunnuntaina klo 17.00–23.59 (Suomen aikaa), tulos maanantaina viikkoraportissa.
-- Jokainen ilmoittautunut äänestää yhtä toista ilmoittautunutta; ääntä voi vaihtaa äänestyksen aikana.
-- Äänet ovat salaisia äänestyksen ajan: muiden äänet näkyvät vasta, kun viikko on päättynyt.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

create or replace function public.week_end(w int) returns date
language sql immutable as $$
  select case when w <= 1 then date '2026-10-04' else public.week_start(w) + 6 end
$$;

create or replace function public.cheer_vote_open(w int) returns boolean
language sql stable as $$
  select (now() at time zone 'Europe/Helsinki') >= (public.week_end(w) + time '17:00')
     and (now() at time zone 'Europe/Helsinki') < (public.week_end(w) + 1)::timestamp
$$;

create table if not exists public.cheer_votes (
  week int not null,
  voter uuid not null references public.profiles(id) on delete cascade,
  nominee uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (week, voter),
  check (voter <> nominee)
);
alter table public.cheer_votes enable row level security;

drop policy if exists "oma ääni ja päättyneet viikot" on public.cheer_votes;
create policy "oma ääni ja päättyneet viikot" on public.cheer_votes for select to authenticated
  using (voter = auth.uid() or (now() at time zone 'Europe/Helsinki') >= (public.week_end(week) + 1)::timestamp);

drop policy if exists "äänestä" on public.cheer_votes;
create policy "äänestä" on public.cheer_votes for insert to authenticated
  with check (
    voter = auth.uid()
    and public.cheer_vote_open(week)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.pledge_locked_at is not null)
    and exists (select 1 from public.profiles p where p.id = nominee and p.pledge_locked_at is not null)
  );

drop policy if exists "vaihda ääni" on public.cheer_votes;
create policy "vaihda ääni" on public.cheer_votes for update to authenticated
  using (voter = auth.uid() and public.cheer_vote_open(week))
  with check (
    voter = auth.uid()
    and public.cheer_vote_open(week)
    and exists (select 1 from public.profiles p where p.id = nominee and p.pledge_locked_at is not null)
  );
