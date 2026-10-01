-- Treenikuva iskuun: kirjaaja voi liittää iskuun valinnaisen kuvan, joka näkyy lokissa.
-- Kuvat ovat julkisessa kuvapaikassa satunnaisella osoitteella (kuten profiilikuvat).
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.hits add column if not exists photo_path text;

insert into storage.buckets (id, name, public) values ('hit-photos', 'hit-photos', true)
  on conflict (id) do nothing;

-- Oman kansion kuvat (kansio = käyttäjän id); ylläpito voi poistaa minkä tahansa.
drop policy if exists "omat treenikuvat" on storage.objects;
create policy "omat treenikuvat" on storage.objects for all to authenticated
  using (bucket_id = 'hit-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'hit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
