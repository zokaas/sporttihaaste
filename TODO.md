# Monsterijahti – todo

Säännöt ja laskenta: `lib/rules.ts` (testit: `npm run test:rules`). Käyttöönotto: `README.md`.

## Päätettävää (porukka)
- [ ] Monsteri viikolle 9 (heikkous: voimailu)
- [ ] Willa Rykmanin heikkous (ehdotus: kestävyys) ja kuvaus
- [ ] Monsterien järjestys (ehdotus alla)
- [ ] Loppupomon nimi ja kuva (paljastetaan viikolla 11)

| Vko | Monsteri | Heikkous |
|---|---|---|
| 1 | Willa Rykman | Kestävyys |
| 2 | Zom-Pieru | Kestävyys |
| 3 | Masi Pallopää | Palloilu |
| 4 | Zam-Pieru | Muu |
| 5 | PunaValmetti | Voimailu |
| 6 | Sunday Scaries -otus | Palloilu |
| 7 | Sauronin silmä | Palloilu |
| 8 | Heikko jää | Kestävyys |
| 9 | ? | Voimailu |
| 10 | Zom-Zam | Voimailu |
| 11 | Loppupomo | – |

## Vaihe 1: ilmoittautuminen (valmis ma 28.9.)
- [x] `npm install` ja `npm run build`, korjaa mahdolliset virheet
- [ ] Supabase-projekti, aja `supabase/schema.sql`
- [ ] Supabase Auth: Site URL, Redirect URL ja suomenkielinen kirjautumisviesti
- [ ] VAPID-avaimet: `npx web-push generate-vapid-keys`
- [ ] GitHub-repo, Vercel-projekti ja ympäristömuuttujat
- [ ] Testaa omalla iPhonella ja Androidilla: kirjautuminen, kuvan lataus, lupaus, kotinäyttö ja testi-ilmoitus
- [ ] Ylläpito-oikeus itselle (SQL READMEssa)
- [ ] Kutsulinkki porukan WhatsAppiin
- [ ] Muistuta ilmoittautumatta olevia (näkyy ylläpidosta)

## Ke 30.9.
- [ ] Ilmoittautuminen sulkeutuu klo 23.59
- [ ] Ylläpito: Lukitse tavoite
- [ ] Willa Rykmanin kuva, kuvaus ja heikkous tietokantaan

## Vaihe 2: kausi (valmis ke 30.9. illalla)
- [ ] Ylläpito: monsterin tiedot ja kuvan lataus, paljastus automaattisesti viikon maanantaina klo 00.00 (viikko 1: to 1.10.)
- [ ] Kirjaus: kuluvan viikon päivät, laji, kesto, seuralaiset, laskelma näkyviin ennen tallennusta (`hitDamage`)
- [ ] Viikon lukitus su 23.59 tietokannan tasolla (ei kirjauksia edelliselle viikolle)
- [ ] Taistelunäkymä: viikon monsteri ja rästit, HP, padottu vahinko, potti ja pottikatto (`computeLedger`)
- [ ] Sinetti: kuka on lyönyt, kuka puuttuu, kipeät harmaana
- [ ] Askelkuittaus (+50) ja partiopäivä (+250, kun kaikki terveet kuittaavat saman päivän)
- [ ] Lupaus: viikon edistyminen (`pledgeHours`), lupausbonus pottiin viikon lukittuessa
- [ ] Oma profiili: sairastuminen (`adjustedPledge`), lupauksen muutos kerran per monsteri, alkaa seuraavalta viikolta
- [ ] Sankarit: järjestys lupausten pidon mukaan, vahinko-välilehti
- [ ] Bestiaario: kaatuneet, nykyinen, tulevat kysymysmerkkeinä, loppupomo ylimpänä
- [ ] Loppupomon viimeinen isku vaatii kaikki kymmenen yhdessä
- [ ] Taistelunäkymän Tänään-kortti: viikon heikkous, päivän juhlapäivä (tai seuraava), päivän partio ja kuka puuttuu
- [ ] Minun viikkoni -kortti: lupauksen eteneminen, askelpäivät ma–su, viikon vahinko, yhteistreenit, bonuksista saatu vahinko
- [ ] Sankarit: Porukan viikko (askelkuittaukset päivittäin, partiopäivät, yhteistreenit, tulevat juhlapäivät) ja välilehdet Lupaukset / Vahinko / Askeleet
- [ ] Toisen sankarin profiili (napautus kuvasta missä tahansa): kauden luvut ja sija, vertailu omiin lukuihin, suosikkilajit, saavutukset, viikon iskut, juhlapäivät
- [ ] Säännöt-sivu (?-kuvake yläkulmassa): säännöt selkokielellä, lajitaulukko, laskuesimerkit, kysymyksiä ja vastauksia
- [ ] Saavutukset: viikon sankari, askelputket, viimeinen isku monsteriin
- [ ] Animaatiot: hengitys, osuma (tärähdys ja punainen välähdys), kaatuminen; vähennetyn liikkeen asetus huomioitu

## Vaihe 3: automaatio (lokakuun aikana)
- [ ] Sunnuntain muistutus klo 18 (Vercel Cron + web-push): lupaus kesken, sinetti puuttuu, askelpäiviä kuittaamatta; ei kipeille
- [ ] Maanantain raportti: monsteri, potti, vahinko, bonusten osuus, lupaukset, viikon sankari, askeleet, tulevat juhlapäivät
- [ ] Raportin jako WhatsAppiin ja tekstin kopiointi
- [ ] Varoitus ylläpidolle, jos bonusten osuus ylittää 25 %

## Joka viikko (ylläpitäjä)
- [ ] Su: tarkista, että seuraavan monsterin kuva ja tiedot ovat valmiina
- [ ] Ma: tarkista raportti ja jaa se porukalle
