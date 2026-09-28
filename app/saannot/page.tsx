import Nav from '@/components/Nav';
import { SPORTS, hitDamage, type Category, BONUS_CAP_PCT, STEP_GOAL, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, PLEDGE_BONUS } from '@/lib/rules';

const CATEGORIES: Category[] = ['Kestävyys', 'Voimailu', 'Palloilu', 'Muu'];

const examples = [
  { text: '1 h salia yksin', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h salia kolmestaan, viikon heikkous voimailu', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 3, celebration: false, weakness: 'Voimailu' }) },
  { text: '30 min uintia yksin', r: hitDamage({ minutes: 30, sportValue: 200, category: 'Kestävyys', groupSize: 1, celebration: false, weakness: null }) },
  { text: '1 h padelia neljästään jonkun syntymäpäivänä', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Palloilu', groupSize: 4, celebration: true, weakness: null }) },
  { text: '1 h juoksua kaikki kymmenen yhdessä juhlapäivänä, heikkous kestävyys', r: hitDamage({ minutes: 60, sportValue: 100, category: 'Kestävyys', groupSize: 10, celebration: true, weakness: 'Kestävyys' }) },
];

const FAQ: [string, string][] = [
  ['Unohdin kirjata treenin. Ehtiikö vielä?', 'Kyllä, jos treeni oli tällä viikolla. Kuluvan viikon päiville voi kirjata sunnuntaihin klo 23.59 asti. Sen jälkeen viikko lukittuu.'],
  ['Kirjasin väärin. Miten korjaan?', 'Poista isku Kirjaa treeni -sivulla ja kirjaa uudelleen. Sekin onnistuu vain kuluvan viikon aikana.'],
  ['Sairastuin. Mitä teen?', 'Paina etusivulla Olen kipeä. Lupauksesi pienenee sairaspäivien verran, eikä sinua tarvita sinettiin sillä viikolla. Kun paranet, paina Olen taas terve.'],
  ['Mitä askelkuittaus tarkoittaa?', `Kuittaa päivä, jona kävelit vähintään ${STEP_GOAL.toLocaleString('fi-FI')} askelta. Jokainen kuitattu päivä tekee ${STEP_DAY_DAMAGE} vahinkoa, mutta askeleet eivät täytä sinettiä.`],
  ['Miksi monsteri ei kaadu, vaikka HP on nollassa?', 'Sinetti on kesken: joku terve sankari ei ole vielä lyönyt sitä treenillä. Vahinko padotaan, ja monsteri kaatuu heti, kun sinetti täyttyy.'],
  ['Mitä rästi tarkoittaa?', 'Monsteri, joka jäi viikolla eloon. Se jatkaa seuraavalla viikolla 1 HP:lla, ja vanhin monsteri ottaa iskut aina ensin.'],
  ['Voinko muuttaa lupaustani?', 'Kerran viikossa, ja muutos alkaa seuraavalta viikolta. Muuta lupausta etusivun Minun viikkoni -kortista.'],
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
        <h2 className="display">Isku</h2>
        <p style={{ margin: 0 }}>Vahinko = treenin kesto tunteina × lajin arvo. Useimmat lajit tekevät 100 vahinkoa tunnissa.</p>
        <table className="plain">
          <thead><tr><th>Bonus</th><th>Lisä</th></tr></thead>
          <tbody>
            <tr><td>Vähintään 3 yhdessä</td><td>+50 %</td></tr>
            <tr><td>Kaikki kymmenen yhdessä</td><td>+100 %</td></tr>
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
        <p style={{ margin: 0 }}>Loppupomo herää ma 14.12. Potti vähennetään sen HP:sta (enintään puolet). Viimeinen isku vaatii kaikki kymmenen samaan treeniin.</p>
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
