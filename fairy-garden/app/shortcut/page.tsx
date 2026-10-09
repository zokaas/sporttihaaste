import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CopyButton from '@/components/CopyButton';

export const dynamic = 'force-dynamic';

export default function ShortcutGuide() {
  const token = cookies().get('fg_token')?.value;
  if (!token) redirect('/');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const url = `${site}/api/steps`;
  const body = JSON.stringify({ token, steps: '<Askeleet>' });

  return (
    <>
      <h1>📲 Askelten automaattisynkka</h1>
      <p className="sub">Tehdään kerran, sen jälkeen iPhone lähettää askeleesi itse.</p>

      <section className="card">
        <h2>Sinun salainen avaimesi 🔑</h2>
        <span className="tok">{token}</span>
        <CopyButton text={token} label="Kopioi avain" />
        <p className="muted">Älä jaa tätä muille: avaimella voi kirjata askelia sinun nimissäsi.</p>
      </section>

      <section className="card">
        <h2>Oikotien teko (Komennot-sovellus)</h2>
        <ol className="steps-list">
          <li>Avaa <b>Komennot</b> → <b>+</b> → uusi komento, nimeksi “Fairy Garden”.</li>
          <li>Lisää <b>Etsi terveysnäytteitä</b>: Tyyppi on <i>Askelmäärä</i>, Alkamispäivä on <i>tänään</i>.</li>
          <li>Lisää <b>Laske tilastot</b>: <i>Summa</i> edellisestä.</li>
          <li>Lisää <b>Hae URL-osoitteen sisältö</b>:
            <code>{url}</code>
            <CopyButton text={url} label="Kopioi osoite" />
            Tapa: <b>POST</b>, pyynnön runko: <b>JSON</b>, ja lisää kentät:
            <code>token = {token}{'\n'}steps = (Laskettu tilasto)</code>
            <CopyButton text={body} label="Kopioi JSON-malli" />
          </li>
          <li>Anna Komennot-sovelluksen käyttää Terveyttä, kun iPhone kysyy.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Automaatio</h2>
        <ol className="steps-list">
          <li>Komennot → <b>Automaatio</b> → <b>+</b> → <b>Vuorokaudenaika</b>, esim. 21:00, joka päivä.</li>
          <li>Valitse “Fairy Garden” ja <b>Suorita heti</b> (ei kysy joka kerta).</li>
        </ol>
        <p className="muted">Jos automaatio ei aina laukea, avaa komento käsin kerran päivässä tai kirjaa askeleet etusivulla.</p>
      </section>

      <Link className="btn" href="/">Takaisin puutarhaan 🌸</Link>
    </>
  );
}
