import Nav from '@/components/Nav';
import { MESSAGES_PER_DAY } from '@/lib/messages';
import { QUIET_END, QUIET_START } from '@/lib/quiet';
import { CATEGORIES, hitDamage, BONUS_CAP_PCT, STEP_GOAL, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, PLEDGE_BONUS } from '@/lib/rules';

import { createClient } from '@/lib/supabase/server';
import { activeSports, loadSports } from '@/lib/sports';

const examples = [
  { text: '1 h salia yksin', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h salia kolmestaan, viikon heikkous voimailu', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 3, celebration: false, weakness: 'Voimailu' }) },
  { text: '30 min uintia yksin', r: hitDamage({ minutes: 30, sportValue: 200, category: 'Kestävyys', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h padelia neljästään jonkun syntymäpäivänä', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Palloilu', groupSize: 4, celebration: true, weakness: null }) },
  { text: '1 h juoksua koko porukka yhdessä juhlapäivänä, heikkous kestävyys', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Kestävyys', groupSize: 10, celebration: true, weakness: 'Kestävyys' }) },
];

const GLOSSARY: [string, string][] = [
  ['Isku', 'Kirjattu treeni. Jokaisella iskulla on voima, joka vähentää monsterin HP:ta.'],
  ['Voima', 'Iskun voima: kesto tunteina × lajin arvo, ja päälle bonukset.'],
  ['HP', 'Monsterin elinvoima. Kun se loppuu ja sinetti on täynnä, monsteri kaatuu.'],
  ['Sinettiraja', 'Niin kauan kuin sinetti on kesken, monsterille jää 10 HP jokaista puuttuvaa sankaria kohden. Se ei siis näy koskaan nollassa ennen kuin kaikki ovat lyöneet.'],
  ['Sinetti', 'Jokaisen terveen sankarin täytyy lyödä viikon monsteria vähintään yhdellä treenillä. Askeleet eivät täytä sinettiä.'],
  ['Rästi', 'Monsteri, joka jäi viikolla henkiin. Se jatkaa seuraavalla viikolla, ja vanhin rästi ottaa iskut ensin.'],
  ['Potti', 'Kaatuneen monsterin yli mennyt voima ja lupausbonukset. Koko potti vähennetään loppupomon HP:sta, eikä sillä ole kattoa.'],
  ['Heikkous', 'Viikon monsterin heikko kohta: joko lajiryhmä (esim. kestävyys) tai yksittäinen laji (esim. uinti). Joskus heikkous on erikoisheikkous, esim. urheilu mamun tai lapsen kanssa, urheilija on nainen tai urheilu kenen tahansa isän kanssa: silloin laji on vapaa ja kirjauksessa merkitset itse, että ehto täyttyi. Heikkouteen osuvat treenit tekevät +50 %. Kaksikolla ja kolmikolla jokaisella osalla on oma heikkoutensa, ja bonus tulee vuorossa olevan osan heikkoudesta.'],
  ['Juhlapäivä', 'Kenen tahansa sankarin nimi- tai syntymäpäivä. Silloin kaikkien iskut tekevät +50 %.'],
  ['Yhteistreeni', 'Vähintään kolmen hengen treeni (+50 %). Koko porukka yhdessä (kaikki sinä päivänä terveet) tekee +100 %.'],
  ['Kriittinen isku', 'Isku, jonka bonukset ovat yhteensä vähintään +100 %.'],
  ['Askelkuittaus', `Päivä, jona kävelit vähintään ${STEP_GOAL.toLocaleString('fi-FI')} askelta: +${STEP_DAY_DAMAGE}.`],
  ['Megamarssi', `Päivä, jona kaikki terveet kuittaavat askeleensa: +${PATROL_DAY_DAMAGE}.`],
  ['Lupaus', `Montako tuntia treenaat viikossa. Pidetty lupaus tuo +${PLEDGE_BONUS} pottiin.`],
  ['Viikon sankari', 'Sankari, joka teki päättyneellä viikolla eniten voimaa.'],
  ['Viimeinen isku', 'Isku, joka kaatoi monsterin.'],
  ['Bestiaario', 'Kauden kaikki monsterit: kaatuneet, nykyinen ja tulevat.'],
];

const FAQ: [string, string][] = [
  ['Unohdin kirjata treenin. Ehtiikö vielä?', 'Kyllä, jos treeni oli tällä viikolla. Kuluvan viikon päiville voi kirjata sunnuntaihin klo 23.59 asti. Sen jälkeen viikko lukittuu.'],
  ['Kirjasin väärin. Miten korjaan?', 'Poista isku Kirjaa treeni -sivulla ja kirjaa uudelleen. Sekin onnistuu vain kuluvan viikon aikana.'],
  ['Sairastuin. Mitä teen?', 'Merkitse Minä-sivun päivärivin alle 🤒 ne päivät, joina olit kipeä (kuluvalta viikolta). Jos merkitset tämän päivän, voit valita jatkuuko sairaus: silloin tulevat päivät merkitään itsestään, kunnes painat Olen taas terve. Jokainen sairaspäivä pienentää viikon lupausta 1/7:lla, yksikin sairaspäivä vapauttaa sen viikon sinetistä, ja megamarssiin riittävät terveet.'],
  ['Mitä askelkuittaus tarkoittaa?', `Kuittaa päivä, jona kävelit vähintään ${STEP_GOAL.toLocaleString('fi-FI')} askelta. Jokainen kuitattu päivä tuo ${STEP_DAY_DAMAGE} voimaa, mutta askeleet eivät täytä sinettiä.`],
  ['Miksi monsterin HP jää 10, 20 tai 30:een?', 'Sinetti on kesken: jokainen puuttuva sankari pitää monsterille 10 HP. Ylimenevä voima kertyy patoon (näkyy etusivulla 🔒), ja monsteri kaatuu heti, kun viimeinenkin puuttuva lyö: silloin pato siirtyy eteenpäin. Jos sinetti jää sunnuntaina vajaaksi, pato menetetään.'],
  ['Mitä rästi tarkoittaa?', 'Monsteri, joka jäi viikolla eloon. Se jatkaa seuraavalla viikolla, ja vanhin monsteri ottaa iskut aina ensin.'],
  ['Voinko muuttaa lupaustani?', 'Et. Lupaus lukittuu ke 30.9. ja pysyy samana koko kauden. Jos sairastut, merkitse itsesi kipeäksi Minä-sivulla: viikon tavoite pienenee sairaspäivien verran.'],
  ['Miksi en saa ilmoituksia?', 'Salli ilmoitukset Minä-sivulla. iPhonessa sovellus pitää ensin lisätä kotinäytölle (Jaa → Lisää Koti-valikkoon) ja avata sieltä. Yöllä klo 22–09 ilmoituksia ei tule, vaan ne lähtevät aamulla klo 9.'],
  ['Mihin ylimääräinen voima menee?', `Kun viikon monsteri on kaatunut, loput iskut menevät pottiin. Potti iskee loppupomoon sen herätessä.`],
];

export default async function Saannot() {
  const sports = activeSports(await loadSports(createClient()));
  return (
    <>
      <Nav current="/saannot" />
      <h1 className="display">Säännöt</h1>

      <section className="card">
        <h2 className="display">Lyhyesti</h2>
        <p style={{ margin: 0 }}>Ennen kautta, ti 29.9.–ke 30.9., porttia vartioi portinvartija Sauronin silmä. Se kaadetaan treeneillä ja askeleilla ilman sinettiä ennen ke klo 23.59. Jos se jää henkiin, jäljelle jäänyt HP siirtyy torstain monsterille; jos se kaatuu, ylijäämä menee pottiin. Ti–ke treenit eivät kerry viikon 1 lupaukseen.</p>
        <p style={{ margin: 0 }}>Kausi kestää 1.10.–20.12. Ensimmäinen monsteri paljastuu to 1.10., ja sen jälkeen uusi joka maanantai: yhteensä 11 monsteria ja viimeisellä viikolla loppupomo. Seuraavaa pääsee lyömään vasta, kun edellinen on tuhottu. Treenit ovat iskuja: jokainen kirjattu treeni vähentää monsterin HP:ta.</p>
        <p style={{ margin: 0 }}>Monsteri kaatuu, kun sen HP loppuu <strong>ja</strong> sinetti on täynnä eli jokainen terve sankari on lyönyt sitä vähintään yhdellä treenillä. Siihen asti monsterille jää 10 HP jokaista puuttuvaa sankaria kohden.</p>
        <p style={{ margin: 0 }}>Jos sinetti jää sunnuntaina vajaaksi, sinettirajan yli mennyt voima menetetään ja monsteri jää rästiin.</p>
      </section>

      <section className="card">
        <h2 className="display">Sanasto</h2>
        <dl className="glossary">
          {GLOSSARY.map(([term, text]) => (
            <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2 className="display">Isku</h2>
        <p style={{ margin: 0 }}>Voima = treenin kesto tunteina × lajin arvo. Useimmissa lajeissa tunnin treenin voima on 100.</p>
        <table className="plain">
          <thead><tr><th>Bonus</th><th>Lisä</th></tr></thead>
          <tbody>
            <tr><td>Vähintään 3 yhdessä</td><td>+50 %</td></tr>
            <tr><td>Koko porukka yhdessä (kaikki sinä päivänä terveet)</td><td>+100 %</td></tr>
            <tr><td>Jonkun nimi- tai syntymäpäivä</td><td>+50 %</td></tr>
            <tr><td>Viikon monsterin heikkous</td><td>+50 %</td></tr>
          </tbody>
        </table>
        <p className="muted small" style={{ margin: 0 }}>Bonukset lasketaan yhteen, katto on +{BONUS_CAP_PCT} %.</p>
      </section>

      <section className="card">
        <h2 className="display">Laskuesimerkit</h2>
        {examples.map((e) => (
          <div key={e.text} className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>{e.text}{e.r.pct ? <span className="muted small"> ({e.r.base} + {e.r.pct} %)</span> : null}</span>
            <strong>{e.r.damage}</strong>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="display">Askeleet ja megamarssi</h2>
        <p style={{ margin: 0 }}>Kun kävelet päivässä vähintään {STEP_GOAL.toLocaleString('fi-FI')} askelta, kuittaa päivä. Se tuo {STEP_DAY_DAMAGE} voimaa. Jos kaikki terveet kuittaavat saman päivän, se on megamarssi: +{PATROL_DAY_DAMAGE}.</p>
      </section>

      <section className="card">
        <h2 className="display">Lupaus</h2>
        <p style={{ margin: 0 }}>Lupaat, montako tuntia treenaat viikossa. Lupaukseen lasketaan voima ilman bonuksia jaettuna sadalla: tunti uintia on 2 h, tunti joogaa 0,5 h.</p>
        <p style={{ margin: 0 }}>Pidetty lupaus tuo +{PLEDGE_BONUS} pottiin, kun viikko lukittuu. Tulostaulun ykkönen on se, joka pitää lupauksensa useimmin.</p>
        <p className="muted small" style={{ margin: 0 }}>Viikko 1 kestää 4 päivää (to 1.10.–su 4.10.), joten sen tavoite on lupaus × 4/7. Sairaspäivät pienentävät tavoitetta.</p>
      </section>

      <section className="card">
        <h2 className="display">Loppupomo</h2>
        <p style={{ margin: 0 }}>Loppupomo herää ma 14.12. Se on vahvempi kuin yksikään kauden monstereista, ja vain koko porukka yhdessä voi sen kaataa. Potti iskee siihen sen herätessä. Muuta siitä ei tiedetä ennen kuin se nousee. Loppupomo kaatuu samoin kuin muut monsterit: HP nollaan ja sinetti täyteen. Jos rästejä on vielä jäljellä, ne pitää kaataa ensin.</p>
      </section>

      <section className="card">
        <h2 className="display">Viestit ja ilmoitukset</h2>
        <p style={{ margin: 0 }}>Viestit-sivulla (📣) voit lähettää porukalle viestin, enintään {MESSAGES_PER_DAY} päivässä ja 200 merkkiä. Ilmoitus viestistä menee kaikille, myös sinulle itsellesi.</p>
        <p style={{ margin: 0 }}><strong>Hiljaiset tunnit klo {QUIET_START}–{String(QUIET_END).padStart(2, '0')}.</strong> Yöllä ei tule yhtään ilmoitusta: silloin syntyvät ilmoitukset ja viestit lähtevät aamulla klo {QUIET_END}.</p>
        <ul className="rules-list">
          <li><strong>👁️ Portinvartija</strong>: ke 30.9. klo {QUIET_END} muistutus, jos portti on vielä kiinni, ja ilmoitus kun se kaatuu.</li>
          <li><strong>👁️ Uusi monsteri</strong>: to 1.10. ja sen jälkeen joka maanantai klo {QUIET_END}.</li>
          <li><strong>⚔️ Perjantaimuistutus</strong>: pe klo {QUIET_END}, vain jos sinulta puuttuu vielä jotain (lupauksen tunnit, isku sinettiin tai askelkuittauksia).</li>
          <li><strong>💀 Monsteri kaatui</strong> ja <strong>⭐ Megamarssi</strong>: heti kaikille.</li>
          <li><strong>⚔️ Vain sinä puutut sinetistä</strong>: heti sille, jonka isku viimeisenä puuttuu.</li>
          <li><strong>⏳ Sinetti odottaa sinua</strong>: kun joku painaa Muistuta puuttuvia (kukin voi muistuttaa kerran kolmessa tunnissa).</li>
        </ul>
        <p className="muted small" style={{ margin: 0 }}>Kun sovellus on auki, näet muiden iskut ja askeleet heti pienenä iskuikkunana ruudun yläreunassa.</p>
      </section>

      <section className="card">
        <h2 className="display">Lajit</h2>
        <table className="plain">
          <thead><tr><th>Laji</th><th>Ryhmä</th><th>/ h</th></tr></thead>
          <tbody>
            {CATEGORIES.flatMap((c) => sports.filter((s) => s.category === c).map((s) => (
              <tr key={s.name}><td>{s.name}</td><td className="muted">{c}</td><td>{s.value}</td></tr>
            )))}
          </tbody>
        </table>
      </section>

      <section className="card faq">
        <h2 className="display">Kysymyksiä</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p style={{ margin: '0 0 8px' }}>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
