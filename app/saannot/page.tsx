import Nav from '@/components/Nav';
import { SPORTS, hitDamage, type Category, BONUS_CAP_PCT, STEP_GOAL, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, PLEDGE_BONUS } from '@/lib/rules';

const CATEGORIES: Category[] = ['Kestävyys', 'Voimailu', 'Palloilu', 'Muu'];

const examples = [
  { text: '1 h salia yksin', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h salia kolmestaan, viikon heikkous voimailu', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 3, celebration: false, weakness: 'Voimailu' }) },
  { text: '30 min uintia yksin', r: hitDamage({ minutes: 30, sportValue: 200, category: 'Kestävyys', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h padelia neljästään jonkun syntymäpäivänä', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Palloilu', groupSize: 4, celebration: true, weakness: null }) },
  { text: '1 h juoksua koko porukka yhdessä juhlapäivänä, heikkous kestävyys', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Kestävyys', groupSize: 10, celebration: true, weakness: 'Kestävyys' }) },
];

const GLOSSARY: [string, string][] = [
  ['Isku', 'Kirjattu treeni. Jokainen isku tekee monsteriin vahinkoa.'],
  ['Vahinko', 'Iskun voima: kesto tunteina × lajin arvo, ja päälle bonukset.'],
  ['HP', 'Monsterin elinvoima. Kun se on nollassa ja sinetti on täynnä, monsteri kaatuu.'],
  ['Sinetti', 'Jokaisen terveen sankarin täytyy lyödä viikon monsteria vähintään yhdellä treenillä. Askeleet eivät täytä sinettiä.'],
  ['Padottu vahinko', 'Vahinko, joka kertyy patoon, kun HP on jo nollassa mutta sinetti on kesken. Pato purkautuu, kun sinetti täyttyy. Jos sinetti jää sunnuntaina vajaaksi, padottu vahinko menetetään.'],
  ['Rästi', 'Monsteri, joka jäi viikolla henkiin. Se jatkaa seuraavalla viikolla 1 HP:lla, ja vanhin rästi ottaa iskut ensin.'],
  ['Potti', 'Kaatuneen monsterin yli mennyt vahinko ja lupausbonukset. Potti vähennetään loppupomon HP:sta.'],
  ['Pottikatto', 'Potti voi vähentää loppupomon HP:sta enintään puolet.'],
  ['Heikkous', 'Viikon monsterin heikko kohta. Sen lajiryhmän treenit tekevät +50 %.'],
  ['Juhlapäivä', 'Kenen tahansa sankarin nimi- tai syntymäpäivä. Silloin kaikkien iskut tekevät +50 %.'],
  ['Yhteistreeni', 'Vähintään kolmen hengen treeni (+50 %). Koko porukka yhdessä tekee +100 %.'],
  ['Kriittinen isku', 'Isku, jonka bonukset ovat yhteensä vähintään +100 %.'],
  ['Askelkuittaus', `Päivä, jona kävelit vähintään ${STEP_GOAL.toLocaleString('fi-FI')} askelta: +${STEP_DAY_DAMAGE}.`],
  ['Partiopäivä', `Päivä, jona kaikki terveet kuittaavat askeleensa: +${PATROL_DAY_DAMAGE}.`],
  ['Lupaus', `Montako tuntia treenaat viikossa. Pidetty lupaus tuo +${PLEDGE_BONUS} pottiin.`],
  ['Viikon sankari', 'Sankari, joka teki päättyneellä viikolla eniten vahinkoa.'],
  ['Viimeinen isku', 'Isku, joka kaatoi monsterin.'],
  ['Bestiaario', 'Kauden kaikki monsterit: kaatuneet, nykyinen ja tulevat.'],
];

const FAQ: [string, string][] = [
  ['Unohdin kirjata treenin. Ehtiikö vielä?', 'Kyllä, jos treeni oli tällä viikolla. Kuluvan viikon päiville voi kirjata sunnuntaihin klo 23.59 asti. Sen jälkeen viikko lukittuu.'],
  ['Kirjasin väärin. Miten korjaan?', 'Poista isku Kirjaa treeni -sivulla ja kirjaa uudelleen. Sekin onnistuu vain kuluvan viikon aikana.'],
  ['Sairastuin. Mitä teen?', 'Paina Minä-sivulla Olen kipeä. Lupauksesi pienenee sairaspäivien verran, eikä sinua tarvita sinettiin sillä viikolla. Kun paranet, paina Olen taas terve.'],
  ['Mitä askelkuittaus tarkoittaa?', `Kuittaa päivä, jona kävelit vähintään ${STEP_GOAL.toLocaleString('fi-FI')} askelta. Jokainen kuitattu päivä tekee ${STEP_DAY_DAMAGE} vahinkoa, mutta askeleet eivät täytä sinettiä.`],
  ['Miksi monsteri ei kaadu, vaikka HP on nollassa?', 'Sinetti on kesken: joku terve sankari ei ole vielä lyönyt sitä treenillä. Vahinko padotaan, ja monsteri kaatuu heti, kun sinetti täyttyy.'],
  ['Mitä rästi tarkoittaa?', 'Monsteri, joka jäi viikolla eloon. Se jatkaa seuraavalla viikolla 1 HP:lla, ja vanhin monsteri ottaa iskut aina ensin.'],
  ['Voinko muuttaa lupaustani?', 'Kerran viikossa, ja muutos alkaa seuraavalta viikolta. Muuta lupausta Minä-sivulla.'],
  ['Mihin ylimääräinen vahinko menee?', `Kun viikon monsteri on kaatunut, loput iskut menevät pottiin. Potti vähennetään loppupomon HP:sta, mutta enintään puolet siitä.`],
];

export default function Saannot() {
  return (
    <>
      <Nav current="/saannot" />
      <h1 className="display">Säännöt</h1>

      <section className="card">
        <h2 className="display">Lyhyesti</h2>
        <p style={{ margin: 0 }}>Kausi kestää 1.10.–20.12. Joka viikko vastassa on uusi monsteri, ja viimeisellä viikolla loppupomo. Treenit ovat iskuja: jokainen kirjattu treeni vähentää monsterin HP:ta.</p>
        <p style={{ margin: 0 }}>Monsteri kaatuu, kun sen HP on nollassa <strong>ja</strong> sinetti on täynnä eli jokainen terve sankari on lyönyt sitä vähintään yhdellä treenillä.</p>
        <p style={{ margin: 0 }}>Jos sinetti jää sunnuntaina vajaaksi, padottu vahinko menetetään ja monsteri jää rästiin 1 HP:lla.</p>
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
        <p style={{ margin: 0 }}>Vahinko = treenin kesto tunteina × lajin arvo. Useimmat lajit tekevät 100 vahinkoa tunnissa.</p>
        <table className="plain">
          <thead><tr><th>Bonus</th><th>Lisä</th></tr></thead>
          <tbody>
            <tr><td>Vähintään 3 yhdessä</td><td>+50 %</td></tr>
            <tr><td>Koko porukka yhdessä (kaikki ilmoittautuneet)</td><td>+100 %</td></tr>
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
        <h2 className="display">Askeleet ja partio</h2>
        <p style={{ margin: 0 }}>Kun kävelet päivässä vähintään {STEP_GOAL.toLocaleString('fi-FI')} askelta, kuittaa päivä. Se tekee {STEP_DAY_DAMAGE} vahinkoa. Jos kaikki terveet kuittaavat saman päivän, se on partiopäivä: +{PATROL_DAY_DAMAGE}.</p>
      </section>

      <section className="card">
        <h2 className="display">Lupaus</h2>
        <p style={{ margin: 0 }}>Lupaat, montako tuntia treenaat viikossa. Lupaukseen lasketaan vahinko ilman bonuksia jaettuna sadalla: tunti uintia on 2 h, tunti joogaa 0,5 h.</p>
        <p style={{ margin: 0 }}>Pidetty lupaus tuo +{PLEDGE_BONUS} pottiin, kun viikko lukittuu. Tulostaulun ykkönen on se, joka pitää lupauksensa useimmin.</p>
        <p className="muted small" style={{ margin: 0 }}>Viikko 1 kestää 11 päivää (to 1.10.–su 11.10.), joten sen tavoite on lupaus × 11/7. Sairaspäivät pienentävät tavoitetta.</p>
      </section>

      <section className="card">
        <h2 className="display">Loppupomo</h2>
        <p style={{ margin: 0 }}>Loppupomo herää ma 14.12. Potti vähennetään sen HP:sta (enintään puolet). Viimeinen isku vaatii kaikki ilmoittautuneet samaan treeniin, ja kaikki täytyy merkitä seuralaisiksi.</p>
      </section>

      <section className="card">
        <h2 className="display">Lajit</h2>
        <table className="plain">
          <thead><tr><th>Laji</th><th>Ryhmä</th><th>/ h</th></tr></thead>
          <tbody>
            {CATEGORIES.flatMap((c) => SPORTS.filter((s) => s.category === c).map((s) => (
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
