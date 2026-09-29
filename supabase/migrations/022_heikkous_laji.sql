-- Heikkous voi olla lajiryhmä (Kestävyys, Voimailu, Palloilu, Muu) tai yksittäinen laji (esim. Uinti, Padel).
-- Poistetaan vanha tarkistus, joka salli vain lajiryhmät. Iskun voima lasketaan sovelluksessa, eikä
-- tietokanta tarkista heikkoutta, joten muuta ei tarvitse muuttaa.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_class t on t.oid = con.conrelid and t.relname = 'monsters'
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%weakness%'
  loop
    execute format('alter table public.monsters drop constraint %I', c.conname);
  end loop;
end $$;
