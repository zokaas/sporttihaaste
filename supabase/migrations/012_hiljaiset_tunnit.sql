-- Viestien hiljaiset tunnit: klo 22–07 lähetetty viesti tallentuu heti, mutta push lähtee vasta aamulla
-- (ajastus /api/cron/aamu). pushed_at kertoo, milloin ilmoitus lähti. Aja Supabasen SQL-editorissa.
alter table public.messages add column if not exists pushed_at timestamptz;
update public.messages set pushed_at = created_at where pushed_at is null;
