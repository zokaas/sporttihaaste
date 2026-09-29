-- Hiljaiset tunnit (klo 22–09) kaikille ilmoituksille: yöllä syntyvät ilmoitukset (monsteri kaatui,
-- megamarssi, "vain sinä puutut", muistutukset) tallentuvat jonoon ja lähtevät aamun ajastuksella klo 9.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
create table if not exists public.push_queue (
  id bigserial primary key,
  payload jsonb not null,
  user_ids uuid[],
  created_at timestamptz not null default now()
);
alter table public.push_queue enable row level security;

-- Kirjautunut sankari voi vain lisätä jonoon (palvelin tekee sen hänen puolestaan). Lukeminen ja
-- tyhjentäminen tehdään ajastuksessa palvelinavaimella, joka ohittaa RLS:n.
drop policy if exists push_queue_insert on public.push_queue;
create policy push_queue_insert on public.push_queue for insert to authenticated with check (true);
grant insert on public.push_queue to authenticated;
grant usage on sequence public.push_queue_id_seq to authenticated;
