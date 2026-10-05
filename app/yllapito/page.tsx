import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TEST_DAY_COOKIE, TEST_SKIP_COOKIE, testDay, testSkipPast } from '@/lib/today';
import { helsinkiToday, formatDay, seasonWeek, weekRange, SEASON_START, SEASON_END, BOSS_WEEK } from '@/lib/season';
import { revalidatePath } from 'next/cache';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { CATEGORIES, SPORT_VALUES, PATROL_DAY_DAMAGE, STEP_DAY_DAMAGE, seasonHp, type Category } from '@/lib/rules';
import { loadBattle } from '@/lib/battle';
import { bonusTenths, hpPlan, weekActual, type WeekActual } from '@/lib/hpcheck';
import { weekRecap } from '@/lib/stats';
import { today } from '@/lib/today';
import { fridayReminders } from '@/lib/reminders';
import { sendOrQueue } from '@/lib/push';
import { isQuietHour } from '@/lib/quiet';
import ConfirmButton from '@/components/ConfirmButton';
import ClearLocalState from '@/components/ClearLocalState';
import MonsterEditor, { type Monster } from '@/components/MonsterEditor';
import GateEditor from '@/components/GateEditor';
import type { GateRow } from '@/lib/gate';
import Nav from '@/components/Nav';
import Hint from '@/components/Hint';

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
  redirect(`/yllapito?tavoite=${encodeURIComponent(error ? `Lukitus epäonnistui: ${error.message}. Onko migraatio 010_kalenteri.sql ajettu?` : 'Tavoite lukittu. Monsterien HP:t on laskettu.')}`);
}

async function saveNav(form: FormData) {
  'use server';
  const supabase = await requireAdmin();
  const mode = (v: FormDataEntryValue | null) => (v === 'on' || v === 'off' ? v : 'auto');
  const { error } = await supabase.from('season').update({ nav_strike: mode(form.get('strike')), nav_bestiary: mode(form.get('bestiary')) }).eq('id', 1);
  revalidatePath('/', 'layout');
  redirect(`/yllapito?nakyvyys=${encodeURIComponent(error ? `Tallennus epäonnistui: ${error.message}. Onko migraatio 013_nakyvyys.sql ajettu?` : 'Näkyvyys tallennettu.')}`);
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
  cookies().set(TEST_SKIP_COOKIE, formData.get('kaada') ? '1' : '0', { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
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
  // Kauden aikana tyhjennys poistaisi oikean pelin iskut, joten se on sallittu vain ennen kautta.
  if (helsinkiToday() >= SEASON_START) redirect(`/yllapito?testi=${encodeURIComponent('Tyhjennys epäonnistui: kausi on jo alkanut.')}`);
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

/** Varjojen ääni: ilmoitus kaikille sankareille ilman lähettäjän nimeä (hiljaisina tunteina aamulla klo 9). */
async function shadowBroadcast(form: FormData) {
  'use server';
  const supabase = await requireAdmin();
  const title = String(form.get('title') ?? '').trim().slice(0, 60) || '👁️ Jokin heräsi';
  const body = String(form.get('body') ?? '').trim().slice(0, 200);
  if (!body) redirect(`/yllapito?push=${encodeURIComponent('Kirjoita viesti ennen lähettämistä.')}#varjot`);
  const { data: heroes } = await supabase.from('profiles').select('id').not('pledge_locked_at', 'is', null);
  const quiet = isQuietHour();
  const sent = await sendOrQueue(supabase, { title, body, url: '/' }, (heroes ?? []).map((h) => h.id));
  redirect(`/yllapito?push=${encodeURIComponent(quiet ? 'Varjojen ääni jonossa: nyt on hiljaiset tunnit, joten se lähtee aamulla klo 9.' : `Varjojen ääni lähti ${sent} laitteeseen.`)}#varjot`);
}

/** Uusi laji kaikkien lajilistaan. Nimeä ja arvoa ei voi muuttaa jälkikäteen, jotta vanhat iskut pysyvät oikein. */
async function addSport(form: FormData) {
  'use server';
  const supabase = await requireAdmin();
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const value = Number(form.get('value'));
  const category = String(form.get('category')) as Category;
  const back = (msg: string) => redirect(`/yllapito?laji=${encodeURIComponent(msg)}#lajit`);
  if (name.length < 2) back('Anna lajille nimi.');
  if (!SPORT_VALUES.includes(value as 50) || !CATEGORIES.includes(category)) back('Valitse ryhmä ja arvo.');
  const { error } = await supabase.from('sports').insert({ name, value, category });
  if (error) back(error.code === '23505' ? `${name} on jo listalla.` : `Lisäys epäonnistui: ${error.message}`);
  revalidatePath('/', 'layout');
  back(`${name} lisätty. Se näkyy nyt kaikilla.`);
}

/** Piilotettu laji jää vanhoihin iskuihin, mutta sille ei voi kirjata uusia. */
async function setSportActive(form: FormData) {
  'use server';
  const supabase = await requireAdmin();
  const name = String(form.get('name'));
  const active = form.get('active') === '1';
  const { error } = await supabase.from('sports').update({ active }).eq('name', name);
  revalidatePath('/', 'layout');
  redirect(`/yllapito?laji=${encodeURIComponent(error ? `Muutos epäonnistui: ${error.message}` : `${name} ${active ? 'palautettu listalle' : 'piilotettu'}.`)}#lajit`);
}

export default async function Yllapito({ searchParams }: { searchParams: { push?: string; testi?: string; tavoite?: string; nollaa?: string; nakyvyys?: string; laji?: string } }) {
  const supabase = await requireAdmin();
  const battle = await loadBattle(supabase, today());
  const lastRecap = battle.week >= 2 ? weekRecap(battle, battle.week - 1) : null;
  const [{ data: heroes }, { data: subs }, { data: season }, { data: monsters }, { data: gateRow, error: gateError }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('push_subscriptions').select('user_id'),
    supabase.from('season').select('*').single(),
    supabase.from('monsters').select('*').order('week'),
    supabase.from('gate').select('name, description, image_path, taunt, hp').eq('id', 1).maybeSingle(),
  ]);
  const withPush = new Set((subs ?? []).map((s) => s.user_id));
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const total = locked.reduce((a, h) => a + Number(h.pledge_hours), 0);
  const preview = seasonHp(total);
  // HP:n realismi: tarvittavat bonukset lupausten ja askelten päälle, sekä toteutunut tahti päättyneiltä viikoilta.
  const planHours = season?.hp_locked_at ? Number(season.total_pledge_hours) : total;
  const hpByWeek = Array.from({ length: BOSS_WEEK }, (_, i) => battle.monsters.get(i + 1)?.hp ?? (i + 1 === BOSS_WEEK ? preview.boss : preview.monsters[i]));
  const actuals: Record<number, WeekActual> = {};
  for (let w = 1; w <= Math.min(battle.week, BOSS_WEEK); w++) {
    actuals[w] = weekActual(
      battle.hits.filter((x) => seasonWeek(x.trained_on) === w),
      battle.steps.filter((x) => seasonWeek(x.day) === w).length,
      battle.patrols.filter((x) => seasonWeek(x.day) === w).length,
      STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE,
      battle.kela.filter((x) => seasonWeek(x.day) === w).reduce((a, x) => a + x.damage, 0),
    );
  }
  // Tahti vain oikeasti päättyneiltä viikoilta (esikatselun testipäivänä kesken oleva viikko ei vääristä sitä).
  const closedWeeks = Object.keys(actuals).map(Number).filter((w) => w < battle.week && weekRange(w).end < helsinkiToday());
  const plan = hpPlan(planHours, hpByWeek, actuals, closedWeeks);
  // Viikkokortin vertailu: paljonko bonusta HP olettaa päättyneelle viikolle (voimana).
  const lastNeed = lastRecap ? plan[lastRecap.week - 1]?.need ?? null : null;
  // Ohje per sankari: viikkojen 2–11 keskimääräinen bonustarve (tällä tahdilla, jos tiedossa) jaettuna sankareille.
  // Yksi bonustreeni tuo +50 % keskimääräisen treenin perusvoimasta.
  const baseHits = battle.hits.filter((h) => seasonWeek(h.trained_on) < battle.week).map((h) => h.damage / (1 + (h.bonus_pct ?? 0) / 100));
  const avgHitBase = baseHits.length ? baseHits.reduce((a, b) => a + b, 0) / baseHits.length : 90;
  const midWeeks = plan.filter((p) => p.week >= 2 && p.week < BOSS_WEEK);
  const avgNeedPower = midWeeks.length ? midWeeks.reduce((a, p) => a + (p.needAtPace ?? p.need), 0) / midWeeks.length : 0;
  const heroCount = Math.max(1, battle.participants.length);
  const bonusTrainingsPerHero = avgNeedPower > 0 ? Math.max(1, Math.ceil(avgNeedPower / heroCount / (avgHitBase * 0.5))) : 0;
  const tenths = (pct: number) => (bonusTenths(pct) >= 10 ? 'bonuksia lähes joka treeniin tai lisätreeniä' : `noin ${bonusTenths(pct)}/10 treenistä bonuksella`);
  const pace = closedWeeks.length ? {
    pledges: Math.round((closedWeeks.reduce((a, w) => a + actuals[w].trainingBase, 0) / closedWeeks.reduce((a, w) => a + plan[w - 1].pledgeBase, 0)) * 100),
    steps: Math.round((closedWeeks.reduce((a, w) => a + actuals[w].steps, 0) / closedWeeks.reduce((a, w) => a + plan[w - 1].stepsEst, 0)) * 100),
  } : null;

  return (
    <>
      <Nav current="/yllapito" />
      <h1 className="display">Ylläpito</h1>
      <Link className="btn btn-ghost" href="/yllapito/korjaukset">🛠️ Korjaukset: iskut, sairaudet ja varmuuskopio</Link>
      {lastRecap ? (
        <section className={`card${lastNeed != null && lastRecap.parts.bonus > lastNeed * 1.5 ? ' threat' : ''}`}>
          <h2 className="display">Viikko {lastRecap.week}</h2>
          <p style={{ margin: 0 }}>Bonuksista tuli <strong>{fmt(lastRecap.parts.bonus)}</strong> voimaa{lastNeed != null ? <>, HP oletti <strong>{fmt(lastNeed)}</strong>.{lastRecap.parts.bonus > lastNeed * 1.5 ? ' ⚠️ Selvästi enemmän: monsterit kaatuvat bonuksilla helpommin kuin HP:t olettavat.' : ''}</> : '.'}</p>
          <a className="tap" href={`/raportti/${lastRecap.week}`}>Viikon raportti ja jako WhatsAppiin →</a>
        </section>
      ) : null}

      {/* Ennen kautta testipäivänä voi myös kirjata; kauden aikana se on pelkkä esikatselu. */}
      {(() => { const preseason = helsinkiToday() < SEASON_START; return (
        <section className="card">
          <h2 className="display">{preseason ? 'Testitila' : 'Esikatselu'}</h2>
          {preseason
            ? <Hint id="admin-test" className="">Kokeile sovellusta ennen kautta: valitse päivä, niin sovellus toimii sinulle kuin se olisi tänään. Muut näkevät sovelluksen normaalisti.</Hint>
            : <Hint id="admin-preview" className="">Katso, miltä sovellus näyttää valittuna päivänä (monsterit, vihjeet, sinetti). Vain katselu: iskuja, askeleita ja sairauksia ei voi kirjata, jotta oikea peli pysyy koskemattomana. Muut näkevät sovelluksen normaalisti.</Hint>}
          <form action={setTestDay} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <input className="input grow" type="date" name="day" min={SEASON_START} max={SEASON_END} defaultValue={testDay() ?? '2026-10-07'} required />
              <button className="btn" type="submit">Aseta</button>
            </div>
            <label className="row" style={{ alignItems: 'center', gap: 10, minHeight: 44 }}>
              <input type="checkbox" name="kaada" defaultChecked={!testDay() || testSkipPast()} style={{ width: 22, height: 22 }} />
              <span>Kaada aiemmat viikot automaattisesti, jotta näet valitun viikon monsterin</span>
            </label>
          </form>
          {testDay() ? (
            <form action={clearTestDay}><button className="btn btn-ghost" type="submit" style={{ width: '100%' }}>{preseason ? "Lopeta testitila" : "Lopeta esikatselu"} ({formatDay(testDay()!)})</button></form>
          ) : null}
          {preseason ? (
            <>
              <form action={resetTestData}>
                <ConfirmButton message="Poistetaanko kaikkien iskut, askeleet, sairaudet ja lupausmuutokset?" className="btn btn-ghost" style={{ width: '100%', color: 'var(--blood-text)' }}>Tyhjennä testidata</ConfirmButton>
              </form>
              <Hint id="admin-reset">Tyhjennys poistaa kaikkien iskut, askeleet, sairaudet, lupausmuutokset ja viestit. Tunnukset ja ilmoittautumiset säilyvät. Portinvartijan oikeat iskut ja askeleet 29.–30.9. säilyvät, vain testitilan kauden päivät (1.10. alkaen) poistetaan. Toimii ennen kauden alkua 1.10.</Hint>
            </>
          ) : null}
          {searchParams.testi ? <p className={`note${searchParams.testi.startsWith('Tyhjennys epäonnistui') ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.testi}</p> : null}
          {searchParams.nollaa ? <ClearLocalState /> : null}
        </section>
      ); })()}

      <section className="card">
        <h2 className="display">Näkyvyys</h2>
        <Hint id="admin-nav">Automaattisesti Lyö näkyy kauden aikana (1.10.–20.12.) ja Bestiaario 1.10. alkaen. Testitilassa automaattinen näkyvyys seuraa testipäivää.</Hint>
        <form action={saveNav} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([['strike', 'Lyö-nappi (alapalkki)', season?.nav_strike], ['bestiary', 'Bestiaario (monsterilistaus)', season?.nav_bestiary]] as const).map(([name, label, value]) => (
            <label key={name} className="field">
              {label}
              <select className="input" name={name} defaultValue={value ?? 'auto'}>
                <option value="auto">Automaattinen (kauden aikana)</option>
                <option value="on">Näytä aina</option>
                <option value="off">Piilota</option>
              </select>
            </label>
          ))}
          <button className="btn" type="submit">Tallenna näkyvyys</button>
        </form>
        {searchParams.nakyvyys ? <p className={`note${searchParams.nakyvyys.startsWith('Tallennus epäonnistui') ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.nakyvyys}</p> : null}
      </section>

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
        <Hint id="admin-friday">Perjantain muistutus lähtee automaattisesti pe klo 9 niille, joilta puuttuu lupauksen tunteja, isku sinettiin tai askelkuittauksia.</Hint>
        {searchParams.push ? <p className="note" role="status" style={{ margin: 0 }}>{searchParams.push}</p> : null}
      </section>

      <section className="card" id="varjot">
        <h2 className="display">👁️ Varjojen ääni</h2>
        <p className="muted small" style={{ margin: 0 }}>Ilmoitus kaikille sankareille ilman lähettäjän nimeä, kuin se tulisi pimeydestä. Ei näy Viestit-sivulla. Klo 22–09 lähetetty lähtee aamulla klo 9.</p>
        <form action={shadowBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            Otsikko
            <input className="input" name="title" maxLength={60} defaultValue="👁️ Jokin heräsi" />
          </label>
          <label className="field">
            Viesti (enintään 200 merkkiä)
            <textarea className="input" name="body" rows={6} maxLength={200} style={{ padding: 12 }} defaultValue="Kaikki kymmenen sankaria ovat nyt kasassa. Pimeydessä jokin nosti päänsä. Se kuuli nimenne ja tietää, että olette tulossa. Torstaina klo 00.00 se astuu esiin. Oletteko valmiita? 🩸" />
          </label>
          <ConfirmButton className="btn" message="Lähetetäänkö varjojen ääni kaikille sankareille?">Lähetä kaikille</ConfirmButton>
        </form>
      </section>

      <section className="card">
        <h2 className="display">HP:n realismi</h2>
        <p style={{ margin: 0 }}>Treenit ja askeleet eivät yksin riitä kaatamaan monsteria: loput pitää tulla bonuksista (3 hengen porukka, heikkous, juhlapäivä). Yksi bonus antaa treenille +50 %. Luvut ovat koko porukan yhteisiä.</p>
        {bonusTrainingsPerHero ? (
          <p className="note" style={{ margin: 0 }}>
            👉 <strong>Per sankari viikossa:</strong> pidä lupaus (keskimäärin {String(Math.round((planHours / heroCount) * 10) / 10).replace('.', ',')} h), kuittaa askeleet 5 päivänä ja tee <strong>{bonusTrainingsPerHero} bonustreeni{bonusTrainingsPerHero > 1 ? 'ä' : ''}</strong>. Silloin monsterit kaatuvat{pace ? ' tähänastisella tahdilla' : ''}.
          </p>
        ) : null}
        {pace ? <p className="muted small" style={{ margin: 0 }}>Tähän asti treenejä on tullut {pace.pledges} % lupauksista ja askeleita {pace.steps} % arviosta (10 sankaria × 5 päivää + megamarssi).</p> : null}
        <ul className="people">
          {plan.map((p) => {
            const got = p.actual ? p.actual.trainingBase + p.actual.bonus + p.actual.steps + p.actual.kela : null;
            const pct = p.needPctAtPace ?? p.needPct;
            return (
              <li key={p.week} style={{ display: 'block' }}>
                <div className="who">{p.week === BOSS_WEEK ? 'Loppupomo' : `Viikko ${p.week}`} · {fmt(p.hp)} HP</div>
                <div className="facts">Lupaukset {fmt(p.pledgeBase)} + askeleet {fmt(p.stepsEst)} → bonuksista pitää tulla {fmt(p.need)}</div>
                {p.need > 0 ? <div className="facts">👉 {tenths(pct)}{p.needPctAtPace != null ? ' (tällä tahdilla)' : ''}</div> : <div className="facts ok">Lupaukset ja askeleet riittävät ilman bonuksia.</div>}
                {p.actual && got != null ? (
                  <div className="facts">
                    Tuli {fmt(got)} = treenit {fmt(p.actual.trainingBase)} + bonukset {fmt(p.actual.bonus)} + askeleet {fmt(p.actual.steps)}{p.actual.kela ? ` + Kela ${fmt(p.actual.kela)}` : ''}
                    {' → '}{got >= p.hp ? <span className="ok">riitti</span> : <span style={{ color: 'var(--blood-text)' }}>puuttui {fmt(p.hp - got)}</span>}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Hint id="admin-hpcheck" className="muted">Loppupomon HP:sta vähennetään vielä ensi-isku, joten sen todellinen tarve on pienempi. Viikko 1 on 4 päivää ja sen HP sisältää portinvartijan jäännöksen. "Tällä tahdilla" käyttää päättyneiden viikkojen treeni- ja askelmääriä.</Hint>
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
                  <td>{m.week === BOSS_WEEK ? 'Loppupomo' : m.name ?? <span className="muted">nimeämättä</span>}</td>
                  <td>{fmt(season?.hp_locked_at ? m.hp : m.week === BOSS_WEEK ? preview.boss : preview.monsters[m.week - 1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Hint id="admin-lock" className="muted">Koko ensi-isku osuu loppupomoon, kattoa ei ole. Lukitse tavoite, kun kaikki ovat ilmoittautuneet. Lukituksen voi tehdä uudelleen, jos joku ilmoittautuu myöhässä.</Hint>
        <form action={lockSeason}><button className="btn" type="submit">{season?.hp_locked_at ? 'Laske ja lukitse uudelleen' : 'Lukitse tavoite'}</button></form>
        {searchParams.tavoite ? <p className={`note${searchParams.tavoite.startsWith('Lukitus epäonnistui') ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.tavoite}</p> : null}
      </section>

      <section className="card" id="portinvartija">
        <h2 className="display">👁️ Portinvartija (ti 29.9.–ke 30.9.)</h2>
        <p className="muted small" style={{ margin: 0 }}>Kauden avaava taistelu ti 29.9.–ke 30.9. klo 23.59. Treenit ja askeleet lyövät, sinettiä ei ole. Jos se jää henkiin, jäljelle jäänyt HP siirtyy viikon 1 monsterille; jos se kaatuu, ylijäämä säästyy ensi-iskuun. Näkyy kaikille heti.</p>
        {gateError ? <p className="note threat" style={{ margin: 0 }}>Aja ensin migraatio 027_portinvartija.sql.</p> : <GateEditor gate={(gateRow ?? { name: null, description: null, image_path: null, taunt: null, hp: null }) as GateRow} />}
      </section>

      <section className="card">
        <h2 className="display">Monsterit</h2>
        <Hint id="admin-monsters" className="muted">Nimi, kuvaus, heikkous ja kuva näkyvät muille vasta monsterin viikon alkaessa (viikko 1: to 1.10., muut maanantaisin klo 00.00).</Hint>
        <MonsterEditor monsters={(monsters ?? []) as Monster[]} sports={battle.sports.filter((x) => x.active)} />
      </section>

      <section className="card" id="lajit">
        <h2 className="display">Lajit</h2>
        <p className="muted small" style={{ margin: 0 }}>Uusi laji näkyy heti kaikilla kirjauksessa, säännöissä ja heikkouksissa. Nimeä ja arvoa ei voi muuttaa jälkikäteen. Laji ei myöskään poistu, mutta sen voi piilottaa: vanhat iskut säilyvät.</p>
        <form action={addSport} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            Nimi
            <input className="input" name="name" minLength={2} maxLength={40} required placeholder="esim. Kuntonyrkkeily" />
          </label>
          <div className="row" style={{ gap: 10 }}>
            <label className="field grow">
              Ryhmä
              <select className="input" name="category" defaultValue="Kestävyys">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field grow">
              Voimaa / h
              <select className="input" name="value" defaultValue="100">
                <option value="100">100 (tavallinen)</option>
                <option value="200">200 (raskas)</option>
                <option value="50">50 (kevyt)</option>
              </select>
            </label>
          </div>
          <ConfirmButton className="btn" message="Lisätäänkö laji? Nimeä ja arvoa ei voi muuttaa jälkikäteen.">Lisää laji</ConfirmButton>
        </form>
        {searchParams.laji ? <p className={`note${/epäonnistui|jo listalla|Anna|Valitse/.test(searchParams.laji) ? ' threat' : ''}`} role="status" style={{ margin: 0 }}>{searchParams.laji}</p> : null}
        <ul className="people">
          {battle.sports.map((x) => (
            <li key={x.name} style={x.active ? undefined : { opacity: 0.55 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="who">{x.name}{x.active ? '' : ' (piilotettu)'}</div>
                <div className="facts">{x.category} · {x.value} / h</div>
              </div>
              <form action={setSportActive}>
                <input type="hidden" name="name" value={x.name} />
                <input type="hidden" name="active" value={x.active ? '0' : '1'} />
                <button className="btn btn-ghost" type="submit" style={{ flex: '0 0 auto' }}>{x.active ? 'Piilota' : 'Palauta'}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
