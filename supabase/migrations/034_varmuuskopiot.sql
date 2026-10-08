-- Automaattiset varmuuskopiot: aamuajo tallentaa joka maanantai kaikki pelitaulut JSON-tiedostona
-- yksityiseen kansioon 'backups'. Vain ylläpitäjä voi ladata ja ottaa kopion käsin.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
insert into storage.buckets (id, name, public) values ('backups', 'backups', false)
  on conflict (id) do nothing;

drop policy if exists "varmuuskopiot ylläpidolle" on storage.objects;
create policy "varmuuskopiot ylläpidolle" on storage.objects for all to authenticated
  using (bucket_id = 'backups' and public.is_admin())
  with check (bucket_id = 'backups' and public.is_admin());
