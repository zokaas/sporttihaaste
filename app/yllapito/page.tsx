import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TEST_DAY_COOKIE, testDay } from '@/lib/today';
import { helsinkiToday, formatDay, SEASON_START, SEASON_END } from '@/lib/season';
import { revalidatePath } from 'next/cache';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { seasonHp } from '@/lib/rules';
import { loadBattle } from '@/lib/battle';
import { weekRecap } from '@/lib/stats';
import { today } from '@/lib/today';
import { fridayReminders } from '@/lib/reminders';
import ConfirmButton from '@/components/ConfirmButton';
import ClearLocalState from '@/components/ClearLocalState';
import MonsterEditor, { type Monster } from '@/components/MonsterEditor';

export const dynamic = 'force-dynamic';

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('fi-FI');
const dm = (v: string | null) => (v ? `${Number(v.split('-')[1])}.${Number(v.split('-')[0])}.` : '–');

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) redirect('/');
  return supabase;
}

async function lockSeason() {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('lock_season');
  revalidatePath('/', 'layout');
  redirect(`/yllapito?tavoite=${encodeURIComponent(error ? `Lukitus epäonnistui: ${error.message}. Onko migraatio 008_lukitus.sql ajettu?` : 'Tavoite lukittu. Monsterien HP:t on laskettu.')}`);
}

async function sendTestPush() {
  'use server';
  const supabase = await requireAdmin();
  let message: string;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const [{ data: subs }, { data: heroes }] = await Promise.all([
      supabase.from('push_subscriptions').select('*'),
      supabase.from('profiles').select('id, hero_name'),
    ]);
    const names = new Map((heroes ?? []).map((h) => [h.id, h.hero_name ?? 'nimetön']));
    const list = subs ?? [];
    const results = await Promise.allSettled(
      list.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: 'Monsterijahti', body: 'Testi-ilmoitus toimii! Ilmoitukset tulevat perille.', url: '/' }),
        ),
      ),
    );
    const failed = results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return [];
      const code = (r.reason as { statusCode?: number })?.statusCode;
      const why = code === 404 || code === 410 ? 'tilaus vanhentunut, laita ilmoitukset uudelleen päälle' : code === 403 ? 'VAPID-avaimet eivät täsmää' : String(code ?? (r.reason as Error)?.message ?? r.reason);
      return [`${names.get(list[i].user_id)}: ${why}`];
    });
    message = list.length === 0
      ? 'Yhtään tilausta ei ole tallennettu. Laita ilmoitukset päälle etusivulta.'
      : `Lähetetty ${list.length - failed.length}/${list.length} laitteeseen.${failed.length ? ` Epäonnistui: ${failed.join('; ')}.` : ''}`;
  } catch (e) {
    message = `Lähetys epäonnistui: ${(e instanceof Error ? e.message : String(e)).replace(/\.$/, '')}. Tarkista VAPID-muuttujat Vercelissä.`;
  }
  redirect(`/yllapito?push=${encodeURIComponent(message)}`);
}

async function setTestDay(formData: FormData) {
  'use server';
  await requireAdmin();
  const day = String(formData.get('day') ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) cookies().set(TEST_DAY_COOKIE, day, { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  redirect('/');
}

async function clearTestDay() {
  'use server';
  await requireAdmin();
  cookies().delete(TEST_DAY_COOKIE);
  redirect('/yllapito');
}

async function resetTestData() {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('reset_test_data');
  revalidatePath('/', 'layout');
  redirect(`/yllapito?testi=${encodeURIComponent(error ? `Tyhjennys epäonnistui: ${error.message}. Onko migraatio 004 ajettu?` : 'Testidata tyhjennetty.')}${error ? '' : '&nollaa=1'}`);
}

async function testFridayReminder() {
  'use server';
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const res = await fridayReminders(supabase, today(), user!.id);
  redirect(`/yllapito?push=${encodeURIComponent(res.skipped ?? `Perjantain muistutus lähetetty itsellesi (${res.sent} laitteeseen).`)}`);
}

export default async function Yllapito({ searchParams }: { searchParams: { push?: string; testi?: string; tavoite?: string; nollaa?: string } }) {
  const supabase = await requireAdmin();
  const battle = await loadBattle(supabase, today());
  const lastRecap = battle.week >= 2 ? weekRecap(battle, battle.week - 1) : null;
  const [{ data: heroes }, { data: subs }, { data: season }, { data: monsters }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('push_subscriptions').select('user_id'),
    supabase.from('season').select('*').single(),
    supabase.from('monsters').select('*').order('week'),
  ]);
  const withPush = new Set((subs ?? []).map((s) => s.user_id));
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const total = locked.reduce((a, h) => a + Number(h.pledge_hours), 0);
  const preview = seasonHp(total);

  return (
    <>
      <h1 className="display">Ylläpito</h1>
      <Link className="btn btn-ghost" href="/yllapito/korjaukset">🛠️ Korjaukset: iskut, sairaudet ja varmuuskopio</Link>
      {lastRecap ? (
        <section className={`card${lastRecap.bonusShare > 25 ? ' threat' : ''}`}>
          <h2 className="display">Viikko {lastRecap.week}</h2>
          <p style={{ margin: 0 }}>Bonusten osuus vahingosta: <strong>{lastRecap.bonusShare} %</strong>{lastRecap.bonusShare > 25 ? ' ⚠️ yli 25 %. Monsterit kaatuvat bonuksilla helpommin kuin HP:t olettavat.' : ' (tavoite alle 25 %)'}</p>
          <a href={`/raportti/${lastRecap.week}`}>Viikon raportti ja jako WhatsAppiin →</a>
        </section>
      ) : null}

      {helsinkiToday() < SEASON_START ? (
        <section className="card">
          <h2 className="display">Testitila</h2>
          <p style={{ margin: 0 }}>Kokeile sovellusta ennen kautta: valitse päivä, niin sovellus toimii sinulle kuin se olisi tänään. Muut näkevät sovelluksen normaalisti.</p>
          <form action={setTestDay} className="row" style={{ alignItems: 'center' }}>
            <input className="input grow" type="date" name="day" min={SEASON_START} max={SEASON_END} defaultValue={testDay() ?? '2026-10-05'} required />
            <button className="btn" type="submit">Aseta</button>
          </form>
          {testDay() ? (
            <form action={clearTestDay}><button className="btn btn-ghost" type="submit" style={{ width: '100%' }}>Lopeta testitila ({formatDay(testDay()!)})</button></form>
          ) : null}
          <form action={resetTestData}>
            <ConfirmButton message="Poistetaanko kaikkien iskut, askeleet, sairaudet ja lupausmuutokset?" className="btn btn-ghost" style={{ width: '100%', color: 'var(--blood-text)' }}>Tyhjennä testidata</ConfirmButton>
          </form>
          <p className="muted small" style={{ margin: 0 }}>Tyhjennys poistaa kaikkien iskut, askeleet, sairaudet ja lupausmuutokset. Tunnukset ja ilmoittautumiset säilyvät. Toimii vain ennen kauden alkua 1.10. Muista tyhjentää ennen kautta!</p>
          {searchParams.testi ? <p className={`note${searchParams.testi.startsWith('Tyhjennys epäonnistui') ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.testi}</p> : null}
          {searchParams.nollaa ? <ClearLocalState /> : null}
        </section>
      ) : null}

      <section className="card">
        <h2 className="display">Ilmoittautuneet {locked.length}/10</h2>
        <ul className="people">
          {(heroes ?? []).map((h) => {
            const src = avatarUrl(h.avatar_path);
            return (
              <li key={h.id}>
                {src ? <img className="avatar" src={src} alt="" width={40} height={40} /> : <div className="avatar" style={{ width: 40, height: 40 }}>?</div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{h.hero_name ?? <span className="muted">Nimi puuttuu</span>}</div>
                  <div className="facts">
                    {h.pledge_locked_at ? `Lupaus ${String(h.pledge_hours).replace('.', ',')} h` : 'Lupaus lukitsematta'}
                    {' · '}Synt. {dm(h.birthday)}{h.birthday && h.birth_year ? h.birth_year : ''}
                    {' · '}Nimip. {dm(h.name_day)}
                  </div>
                  <div className="facts">Ilmoitukset: {withPush.has(h.id) ? <span className="ok">päällä</span> : <span className="error">pois</span>}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <form action={sendTestPush}><button className="btn btn-ghost" type="submit" style={{ width: '100%' }}>Lähetä testi-ilmoitus kaikille</button></form>
        <form action={testFridayReminder}><button className="btn btn-ghost" type="submit" style={{ width: '100%' }}>Kokeile perjantain muistutusta (vain itsellesi)</button></form>
        <p className="muted small" style={{ margin: 0 }}>Perjantain muistutus lähtee automaattisesti pe klo 9 (talviaikana klo 8) niille, joilta puuttuu lupauksen tunteja, isku sinettiin tai askelkuittauksia.</p>
        {searchParams.push ? <p className="note" role="status" style={{ margin: 0 }}>{searchParams.push}</p> : null}
      </section>

      <section className="card">
        <h2 className="display">Tavoite</h2>
        {season?.hp_locked_at ? (
          <p className="ok" style={{ margin: 0 }}>
            Lukittu {new Date(season.hp_locked_at).toLocaleString('fi-FI')}: lupaukset {String(season.total_pledge_hours).replace('.', ',')} h, viikkovauhti {fmt(season.pace)}.
          </p>
        ) : (
          <p style={{ margin: 0 }}>Esikatselu nykyisillä lupauksilla ({String(total).replace('.', ',')} h): viikkovauhti {fmt(preview.pace)}.</p>
        )}
        <div className="scroll">
          <table className="admin">
            <thead><tr><th>Viikko</th><th>Monsteri</th><th>HP</th></tr></thead>
            <tbody>
              {(monsters ?? []).map((m) => (
                <tr key={m.week}>
                  <td>{m.week}</td>
                  <td>{m.week === 11 ? 'Loppupomo' : m.name ?? <span className="muted">nimeämättä</span>}</td>
                  <td>{fmt(season?.hp_locked_at ? m.hp : m.week === 11 ? preview.boss : preview.monsters[m.week - 1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: 0 }}>Pottikatto on puolet loppupomon HP:sta. Lukitse tavoite, kun kaikki ovat ilmoittautuneet. Lukituksen voi tehdä uudelleen, jos joku ilmoittautuu myöhässä.</p>
        <form action={lockSeason}><button className="btn" type="submit">{season?.hp_locked_at ? 'Laske ja lukitse uudelleen' : 'Lukitse tavoite'}</button></form>
        {searchParams.tavoite ? <p className={`note${searchParams.tavoite.startsWith('Lukitus epäonnistui') ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.tavoite}</p> : null}
      </section>

      <section className="card">
        <h2 className="display">Monsterit</h2>
        <p className="muted" style={{ margin: 0 }}>Nimi, kuvaus, heikkous ja kuva näkyvät muille vasta monsterin viikon alkaessa (viikko 1: to 1.10., muut maanantaisin klo 00.00).</p>
        <MonsterEditor monsters={(monsters ?? []) as Monster[]} />
      </section>
    </>
  );
}
