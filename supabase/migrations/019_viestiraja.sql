-- Viestiraja nostetaan kahteen päivässä (ylläpidolla ei rajaa). Lukko estää samanaikaiset lähetykset.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
create or replace function public.guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if public.is_admin() then return new; end if;
  perform pg_advisory_xact_lock(hashtext('message-' || new.sender::text));
  if (
    select count(*) from public.messages
    where sender = new.sender and (created_at at time zone 'Europe/Helsinki')::date = public.helsinki_today()
  ) >= 2 then
    raise exception 'Olet jo lähettänyt tänään kaksi viestiä. Seuraavan voit lähettää huomenna.';
  end if;
  return new;
end $$;
