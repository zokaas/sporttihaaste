-- Pelitapahtumat: muistutukset, push-ilmoitukset ja reaaliaikainen taisteluloki.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

-- Muistuta-painike: kuka muistutti ketä, jotta samaa ei voi lähettää jatkuvasti.
create table if not exists public.nudges (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles on delete cascade,
  week int not null,
  created_at timestamptz not null default now()
);
alter table public.nudges enable row level security;
drop policy if exists "omat muistutukset" on public.nudges;
create policy "omat muistutukset" on public.nudges for all to authenticated using (sender = auth.uid()) with check (sender = auth.uid());

-- Kertaluonteiset ilmoitukset (esim. "monsteri 3 kaatui") lähetetään vain kerran.
create table if not exists public.notifications_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.notifications_sent enable row level security;

-- Varaa ilmoituksen avaimen. Palauttaa true vain ensimmäiselle kutsujalle.
create or replace function public.claim_notification(k text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.notifications_sent (key) values (k) on conflict do nothing;
  return found;
end $$;
revoke all on function public.claim_notification(text) from public;
grant execute on function public.claim_notification(text) to authenticated;

-- Push-tilaukset annetuille sankareille (null = kaikki). Tilauksilla ei voi lähettää mitään ilman
-- palvelimen VAPID-yksityisavainta, joten niiden luovuttaminen palvelimelle on turvallista.
create or replace function public.push_targets(ids uuid[] default null)
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.endpoint, s.p256dh, s.auth from public.push_subscriptions s
  where auth.uid() is not null and (ids is null or s.user_id = any(ids))
$$;
revoke all on function public.push_targets(uuid[]) from public;
grant execute on function public.push_targets(uuid[]) to authenticated;

-- Reaaliaikainen taisteluloki: iskut ja askeleet Supabase Realtimeen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'hits') then
      alter publication supabase_realtime add table public.hits;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'step_days') then
      alter publication supabase_realtime add table public.step_days;
    end if;
  end if;
end $$;
