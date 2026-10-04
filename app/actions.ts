'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { addDays, loggableDays, seasonWeek, BOSS_WEEK } from '@/lib/season';
import { PREVIEW_ERROR, previewOnly, today } from '@/lib/today';
import { afterStep } from '@/lib/events';
import { loadBattle } from '@/lib/battle';
import { sendOrQueue, sendPush } from '@/lib/push';
import { isQuietHour } from '@/lib/quiet';
import { isSickOn, type SickPeriod } from '@/lib/weekly';
import { strikeSummary, type StrikeSummary } from '@/lib/strike';
import { sealView } from '@/lib/rules';

type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function done(error: { message: string } | null): Result {
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Kuittaa tai peruu askelpäivän (+50). */
export async function toggleStep(day: string, on: boolean, withStrike = false): Promise<Result & { strike?: StrikeSummary }> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  if (!loggableDays(today()).includes(day)) return { ok: false, error: 'Päivää ei voi enää kuitata.' };
  if (on) {
    const { data: sick } = await supabase.from('sick_periods').select('user_id, starts_on, ends_on').eq('user_id', user.id);
    if (isSickOn((sick ?? []) as SickPeriod[], user.id, day)) return { ok: false, error: 'Päivä on merkitty sairaspäiväksi. Poista sairausmerkintä ensin, jos kävelit silti.' };
  }
  const { error } = on
    ? await supabase.from('step_days').upsert({ user_id: user.id, day })
    : await supabase.from('step_days').delete().eq('user_id', user.id).eq('day', day);
  if (!error && on) await afterStep(supabase, day).catch(() => {});
  const res = done(error);
  // Lyö-valikko näyttää iskuikkunan: monsterin tilanne askelten jälkeen.
  if (res.ok && on && withStrike) return { ...res, strike: await strikeSummary(supabase, today()).catch(() => null) };
  return res;
}

/**
 * Merkitsee kuluvan viikon päivän sairaaksi tai terveeksi. Tälle päivälle voi valita, jatkuuko sairaus
 * (avoin jakso, joka päättyy vasta "Olen taas terve" -merkinnällä). Terveeksi merkitty päivä pilkkoo
 * olemassa olevan jakson kahteen osaan tarvittaessa.
 */
export async function toggleSickDay(day: string, sick: boolean, continuing = false): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const now = today();
  if (!loggableDays(now).includes(day)) return { ok: false, error: 'Sairaspäivän voi merkitä vain kuluvalle viikolle, ei tulevaisuuteen.' };
  if (seasonWeek(day) < 1) return { ok: false, error: 'Portinvartijan päivänä sairautta ei tarvitse merkitä: sinettiä ei ole.' };
  const { data } = await supabase.from('sick_periods').select('id, starts_on, ends_on').eq('user_id', user.id);
  const covering = (data ?? []).filter((x) => x.starts_on <= day && (x.ends_on === null || x.ends_on >= day));

  if (sick) {
    if (covering.length) return done(null);
    // Kipeänä ei treenata: päivälle kirjattu treeni pitää poistaa ensin, askeleet poistuvat automaattisesti.
    const { data: trained } = await supabase.from('hits').select('id').eq('user_id', user.id).eq('trained_on', day).limit(1);
    if (trained?.length) return { ok: false, error: 'Päivälle on kirjattu treeni. Poista treeni ensin, jos olit kipeä.' };
    const { error: stepError } = await supabase.from('step_days').delete().eq('user_id', user.id).eq('day', day);
    if (stepError) return done(stepError);
    const open = continuing && day === now;
    return done((await supabase.from('sick_periods').insert({ user_id: user.id, starts_on: day, ends_on: open ? null : day })).error);
  }

  for (const x of covering) {
    // Jakson loppuosa päivän jälkeen säilyy (avoin jakso jatkuu vain, jos päivä ei ole tämä päivä).
    const restEnd: string | null = x.ends_on === null ? null : x.ends_on;
    const restStart = addDays(day, 1);
    const keepRest = restStart <= now && (restEnd === null || restEnd >= restStart);
    const { error } = x.starts_on === day
      ? await supabase.from('sick_periods').delete().eq('id', x.id)
      : await supabase.from('sick_periods').update({ ends_on: addDays(day, -1) }).eq('id', x.id);
    if (error) return done(error);
    if (keepRest) {
      const { error: e2 } = await supabase.from('sick_periods').insert({ user_id: user.id, starts_on: restStart, ends_on: restEnd });
      if (e2) return done(e2);
    }
  }
  return done(null);
}

/** Muuttaa lupauksen seuraavasta viikosta alkaen. Kerran viikossa; saman viikon aikana voi vielä korjata. */
/** Lupausta ei voi muuttaa kauden aikana (päätös 28.9.). Ylläpitäjä voi yhä korjata lupauksia tietokannassa. */
export async function changePledge(_hours: number): Promise<Result> {
  return { ok: false, error: 'Lupausta ei voi muuttaa kauden aikana.' };
}

/** Muistuttaa sinetistä puuttuvia push-ilmoituksella. Kerran kolmessa tunnissa per lähettäjä. */
export async function nudgeMissing(): Promise<Result & { sent?: number }> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const b = await loadBattle(supabase, today());
  const target = b.ledger?.alive[0];
  if (!target) return { ok: false, error: 'Ei monsteria, jota muistuttaa.' };
  const missing = b.required.filter((id) => !target.hitters.includes(id) && id !== user.id);
  if (!missing.length) return { ok: false, error: 'Kaikki muut ovat jo lyöneet.' };

  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: recent } = await supabase.from('nudges').select('id').eq('sender', user.id).gte('created_at', since).limit(1);
  if (recent?.length) return { ok: false, error: 'Muistutit jo äskettäin. Voit muistuttaa uudelleen kolmen tunnin päästä.' };
  await supabase.from('nudges').insert({ sender: user.id, week: b.week });

  const sender = b.heroes.find((h) => h.id === user.id)?.hero_name ?? 'Sankari';
  const monster = b.monsters.get(target.week)?.name ?? 'Monsteri';
  // Sama pato kuin etusivun kortissa: sinettirajan alle kertynyt voima.
  const dam = sealView(target, b.required).dam;
  const sent = await sendOrQueue(supabase, {
    title: '⏳ Sinetti odottaa sinua',
    body: dam
      ? `${sender} muistuttaa: ${dam.toLocaleString('fi-FI')} voimaa odottaa sinua! ${monster} on sinettirajalla ja kaatuu heti, kun lyöt. Muuten pato menetetään sunnuntaina.`
      : `${sender} muistuttaa: ${monster} kaatuu vasta, kun jokainen on lyönyt. Sinun iskusi puuttuu.`,
  }, missing);
  return { ok: true, sent };
}

/** Viesti porukalle: push kaikille (myös lähettäjälle) ja näkyy Viestit-sivulla. Tietokanta rajaa kahteen päivässä (ylläpito rajatta). */
export async function sendMessage(text: string): Promise<Result & { sent?: number; queued?: boolean }> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const body = text.trim().replace(/\s+\n/g, '\n');
  if (!body) return { ok: false, error: 'Kirjoita viesti.' };
  if (body.length > 200) return { ok: false, error: 'Viesti on liian pitkä (enintään 200 merkkiä).' };
  // Hiljaiset tunnit klo 22–09: viesti tallentuu, mutta push lähtee vasta aamun ajastuksella klo 9.
  const quiet = isQuietHour();
  const { error } = await supabase.from('messages').insert({ sender: user.id, body, pushed_at: quiet ? null : new Date().toISOString() });
  if (error) return { ok: false, error: error.message.includes('messages') ? 'Viestejä ei voi vielä lähettää. Ylläpitäjän pitää ajaa migraatiot 011, 012 ja 019.' : error.message };
  if (quiet) {
    revalidatePath('/viestit');
    return { ok: true, sent: 0, queued: true };
  }

  const [{ data: sender }, { data: heroes }] = await Promise.all([
    supabase.from('profiles').select('hero_name').eq('id', user.id).single(),
    supabase.from('profiles').select('id').not('pledge_locked_at', 'is', null),
  ]);
  // Ilmoitus menee kaikille, myös lähettäjälle (näkee, että viesti lähti perille).
  const everyone = (heroes ?? []).map((h) => h.id);
  const sent = await sendPush(supabase, { title: `📣 ${sender?.hero_name ?? 'Sankari'}`, body, url: '/viestit' }, everyone);
  revalidatePath('/viestit');
  return { ok: true, sent };
}

/** Ylläpitäjä voi poistaa viestin. */
export async function deleteMessage(id: number): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/viestit');
  return { ok: true };
}

/** Nykyisen vastustajan tilanne iskuikkunaa varten (esim. kun kaveri lyö ja sovellus on auki). */
export async function currentStrike(): Promise<StrikeSummary> {
  const { supabase, user } = await me();
  if (!user) return null;
  return strikeSummary(supabase, today()).catch(() => null);
}
