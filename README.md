# Monsterijahti – vaihe 1: ilmoittautuminen

Tämä versio sisältää kirjautumisen, ilmoittautumisen (sankarinimi ja kuva, juhlapäivät, lupauksen lukitus, push-ilmoitukset) ja ylläpitonäkymän, josta lukitaan kauden tavoite. Kauden pelinäkymät (kirjaus, taistelu, sinetti, askeleet, sankarit, bestiaario) tulevat vaiheessa 2. Niiden laskenta on jo valmiina ja testattuna tiedostossa `lib/rules.ts`.

## Käyttöönotto (noin 30 min)

### 1. Supabase
1. Luo ilmainen projekti osoitteessa supabase.com. Valitse alueeksi esimerkiksi Stockholm.
2. Avaa **SQL Editor**, liitä koko `supabase/schema.sql` ja aja se.
3. **Authentication → Sign In / Providers → Email:** kytke **Confirm email** pois päältä. Kirjautuminen tapahtuu käyttäjänimellä ja salasanalla, eikä sovellus lähetä sähköposteja.
4. Kopioi **Project Settings → API** -sivulta *Project URL* ja *anon public key*.

### 2. Push-ilmoitusten avaimet
Aja omalla koneella:
```
npx web-push generate-vapid-keys
```
Talleta *Public Key* ja *Private Key*.

### 3. Vercel
1. Lisää kansio GitHubiin ja tuo se Verceliin (Add New → Project).
2. Lisää ympäristömuuttujat `.env.example`-tiedoston mukaisesti.
3. Deploy. Sovellus on valmis, kun osoite aukeaa kirjautumissivulle.

### 4. Tee itsestäsi ylläpitäjä
Kirjaudu sovellukseen kerran, ja aja sitten Supabasen SQL-editorissa:
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'kayttajanimesi@monsterijahti.app');
```
Etusivulle ilmestyy **Ylläpito**-painike.

### 5. Kutsu porukka
Jaa sovelluksen osoite WhatsAppiin. Jokainen luo itselleen käyttäjänimen ja salasanan ja käy ilmoittautumisen läpi ke 30.9. mennessä. Ylläpitonäkymästä näet, kuka on valmis ja kenellä ilmoitukset ovat päällä. **Lähetä testi-ilmoitus** kertoo, toimivatko ilmoitukset.

### 6. Lukitse tavoite ke 30.9. illalla
Paina ylläpidossa **Lukitse tavoite**. Monsterien HP lasketaan kaikkien lupauksista samalla kaavalla kuin säännöissä:

- Viikkovauhti = lupaukset yhteensä × 100 × 1,2 + 2 750
- Willa Rykman = 80 % × 11/7, monsterit 2–10 = 82 % → 100 %, loppupomo = 150 %
- Pottikatto = puolet loppupomosta

Jos joku ilmoittautuu myöhässä, paina **Laske ja lukitse uudelleen**.

## Hyvä tietää
- Käyttäjänimet näkyvät Supabasessa (Authentication → Users) muodossa `nimi@monsterijahti.app`.
- Unohtunut salasana: ylläpitäjä asettaa uuden SQL-editorissa:
  ```sql
  update auth.users set encrypted_password = extensions.crypt('uusisalasana', extensions.gen_salt('bf'))
  where email = 'nimi@monsterijahti.app';
  ```
- Nimi, kuva, juhlapäivät ja lupaus lukittuvat tietokannassa automaattisesti ke 30.9. klo 23.59. Ylläpitäjä voi yhä korjata niitä.
- Monsterien nimet, kuvaukset, heikkoudet ja kuvat eivät näy muille ennen paljastusta. Ne luetaan näkymästä `monsters_public`.
- iPhonessa ilmoitukset toimivat vain, kun sovellus on lisätty Koti-valikkoon ja avattu sieltä (iOS 16.4 tai uudempi).
- Sääntötestit: `npm run test:rules`

## Paikallinen kehitys
```
npm install
cp .env.example .env.local   # täytä arvot
npm run dev
```
