'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { addDays, loggableDays, seasonWeek, BOSS_WEEK } from '@/lib/season';
import { today } from '@/lib/today';
import { afterStep } from '@/lib/events';
import { loadBattle } from '@/lib/battle';
import { sendPush } from '@/lib/push';

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
export async function toggleStep(day: string, on: boolean): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  if (!loggableDays(today()).includes(day)) return { ok: false, error: 'Päivää ei voi enää kuitata.' };
  const { error } = on
    ? await supabase.from('step_days').upsert({ user_id: user.id, day })
    : await supabase.from('step_days').delete().eq('user_id', user.id).eq('day', day);
  if (!error && on) await afterStep(supabase, day).catch(() => {});
  return done(error);
}

/** Merkitsee sairastumisen (tästä päivästä tai valitusta kuluvan viikon päivästä) tai paranemisen (viimeinen sairaspäivä = eilen). */
export async function setSick(sick: boolean, from?: string): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const now = today();
  const { data: open } = await supabase.from('sick_periods').select('id, starts_on').eq('user_id', user.id).is('ends_on', null).maybeSingle();
  if (sick) {
    if (open) return { ok: true };
    const start = from && loggableDays(now).includes(from) ? from : now;
    return done((await supabase.from('sick_periods').insert({ user_id: user.id, starts_on: start })).error);
  }
  if (!open) return { ok: true };
  // Tänään alkanut sairaus perutaan kokonaan, muuten viimeinen sairaspäivä oli eilen.
  const { error } = open.starts_on >= now
    ? await supabase.from('sick_periods').delete().eq('id', open.id)
    : await supabase.from('sick_periods').update({ ends_on: addDays(now, -1) }).eq('id', open.id);
  return done(error);
}

/** Muuttaa lupauksen seuraavasta viikosta alkaen. Kerran viikossa; saman viikon aikana voi vielä korjata. */
/** Lupausta ei voi muuttaa kauden aikana (päätös 28.9.). Ylläpitäjä voi yhä korjata lupauksia tietokannassa. */
export async function changePledge(_hours: number): Promise<Result> {
  return { ok: false, error: 'Lupausta ei voi muuttaa kauden aikana.' };
}

/** Muistuttaa sinetistä puuttuvia push-ilmoituksella. Kerran kolmessa tunnissa per lähettäjä. */
export async function nudgeMissing(): Promise<Result & { sent?: number }> {
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
  const sent = await sendPush(supabase, {
    title: '⏳ Sinetti odottaa sinua',
    body: target.padded
      ? `${sender} muistuttaa: ${monster} on jo sinettirajalla, ${target.padded} voimaa odottaa padottuna. Tarvitaan vain sinun iskusi!`
      : `${sender} muistuttaa: ${monster} kaatuu vasta, kun jokainen on lyönyt. Sinun iskusi puuttuu.`,
  }, missing);
  return { ok: true, sent };
}

/** Viesti porukalle: push kaikille muille ja näkyy Viestit-sivulla. Tietokanta rajaa yhteen päivässä (ylläpito rajatta). */
export async function sendMessage(text: string): Promise<Result & { sent?: number; queued?: boolean }> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const body = text.trim().replace(/\s+\n/g, '\n');
  if (!body) return { ok: false, error: 'Kirjoita viesti.' };
  if (body.length > 200) return { ok: false, error: 'Viesti on liian pitkä (enintään 200 merkkiä).' };
  // Hiljaiset tunnit klo 22–07: viesti tallentuu, mutta push lähtee vasta aamun ajastuksella.
  const hour = Number(new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const quiet = hour >= 22 || hour < 7;
  const { error } = await supabase.from('messages').insert({ sender: user.id, body, pushed_at: quiet ? null : new Date().toISOString() });
  if (error) return { ok: false, error: error.message.includes('messages') ? 'Viestejä ei voi vielä lähettää. Ylläpitäjän pitää ajaa migraatiot 011 ja 012.' : error.message };
  if (quiet) {
    revalidatePath('/viestit');
    return { ok: true, sent: 0, queued: true };
  }

  const [{ data: sender }, { data: heroes }] = await Promise.all([
    supabase.from('profiles').select('hero_name').eq('id', user.id).single(),
    supabase.from('profiles').select('id').not('pledge_locked_at', 'is', null),
  ]);
  const others = (heroes ?? []).map((h) => h.id).filter((id) => id !== user.id);
  const sent = await sendPush(supabase, { title: `📣 ${sender?.hero_name ?? 'Sankari'}`, body, url: '/viestit' }, others);
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
