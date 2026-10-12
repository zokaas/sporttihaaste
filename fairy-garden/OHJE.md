# Fairy Garden – täydellinen käyttöönotto-ohje

## A. Ylläpitäjä (sinä), noin 20 min
1. **Supabase:** supabase.com → New project (alue esim. Stockholm).
2. **Tietokanta:** SQL Editor → liitä `fairy-garden/supabase/schema.sql` → Run.
3. **Avaimet:** Project Settings → API → kopioi *Project URL* ja *service_role*-avain (salainen, vain palvelimelle).
4. **Vercel:** Add New → Project → valitse repo `zokaas/sporttihaaste`.
5. **Root Directory:** `fairy-garden`.
6. **Ympäristömuuttujat:**
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role-avain
   - `NEXT_PUBLIC_SITE_URL` = Vercelin antama osoite (ilman loppukauttaviivaa)
7. **Deploy.** Avaa osoite: näet etusivun ja liittymislomakkeen.
8. **Testaa itse:** liity nimellä, avaa `/shortcut`, tee oikotie (kohta B) ja varmista, että askeleet näkyvät.
9. **Jaa osoite** porukan WhatsAppiin ohjeen kera (kohta B).

## B. Jokainen keiju, noin 5 min (kerran)
1. Avaa osoite **Safarilla** (ei WhatsAppin selaimella).
2. Jaa-painike → **Lisää Koti-valikkoon**.
3. Avaa sovellus kotinäytöltä → kirjoita keijun nimi → **Istuta siemen**.
4. Sovellus avaa `/shortcut`-ohjeen. Kopioi avain ja osoite sieltä.
5. **Komennot-sovellus** → + → nimeksi “Fairy Garden”.
6. Lisää toiminto **Etsi terveysnäytteitä**: Tyyppi = Askelmäärä, Alkamispäivä = tänään.
7. Lisää **Laske tilastot**: Summa.
8. Lisää **Hae URL-osoitteen sisältö**: osoite = `…/api/steps`, tapa **POST**, runko **JSON**, kentät `token` (oma avain) ja `steps` (Laskettu tilasto).
9. Aja komento kerran käsin ja salli pääsy Terveyteen. Etusivulla tämän päivän askeleet päivittyvät.
10. **Automaatio:** Komennot → Automaatio → + → Vuorokaudenaika (esim. 21:00, päivittäin) → komento “Fairy Garden” → **Suorita heti**.

## C. Arki
- Jos automaatio ei laukea, avaa komento käsin tai kirjaa askeleet etusivulla.
- Liikunta kirjataan etusivulla (laji + minuutit).
- Pisteet: 1 p / 1 000 askelta ja 1 p / 10 min liikuntaa.

## D. Jos jokin ei toimi
- “Tuntematon token”: avain on kopioitu väärin, kopioi se `/shortcut`-sivulta uudelleen.
- Askeleet eivät päivity: tarkista, että komennolla on lupa Terveyteen ja että osoite päättyy `/api/steps`.
- Uusi puhelin: liity uudelleen tai kopioi vanha avain komentoon.
