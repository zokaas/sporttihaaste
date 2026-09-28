import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBattle } from './battle';
import { sendPush } from './push';
import { STEP_GOAL } from './rules';
import { addDays, weekRange } from './season';
import { isSickOn } from './weekly';

const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;

/**
 * Perjantaiaamun muistutus: jokaiselle terveelle sankarille oma viesti siitä, mitä viikolta vielä puuttuu
 * (lupauksen tunnit, isku sinettiin, askelkuittaukset). Ei lähetä mitään sille, jolla kaikki on kunnossa.
 * onlyUser: lähetä vain tälle sankarille (ylläpitäjän testi).
 */
export async function fridayReminders(supabase: SupabaseClient, day: string, onlyUser?: string) {
  const b = await loadBattle(supabase, day);
  if (!b.ledger) return { sent: 0, skipped: 'Taistelu ei ole käynnissä.' };
  const target = b.ledger.alive[0];
  const monster = target ? b.monsters.get(target.week)?.name ?? 'monsteri' : null;
  const { start, end } = weekRange(b.week);
  let daysSoFar = 0;
  for (let d = start; d <= day && d <= end; d = addDays(d, 1)) daysSoFar++;

  let sent = 0;
  const people = b.participants.filter((id) => (!onlyUser || id === onlyUser) && !isSickOn(b.periods, id, day));
  for (const id of people) {
    const lines: string[] = [];
    const status = b.pledgeStatus(id, b.week);
    if (status.target > 0 && status.hours < status.target) lines.push(`Lupauksesta puuttuu ${h(status.target - status.hours)}.`);
    if (target && b.required.includes(id) && !target.hitters.includes(id)) {
      lines.push(target.padded ? `${monster} odottaa sinun iskuasi – ${target.padded} vahinkoa on padottuna!` : `Et ole vielä lyönyt ${monster}a, ja sinetti tarvitsee sinut.`);
    }
    const steps = b.steps.filter((s) => s.user_id === id && s.day >= start && s.day <= day).length;
    if (steps < daysSoFar) lines.push(`Askelkuittauksia ${steps}/${daysSoFar} (${STEP_GOAL.toLocaleString('fi-FI')} askelta = +50).`);
    if (!lines.length && !onlyUser) continue;
    sent += await sendPush(
      supabase,
      {
        title: lines.length ? `⚔️ Viikonloppu tulee – viikko ${b.week} päättyy sunnuntaina` : '⚔️ Kaikki kunnossa tällä viikolla!',
        body: lines.length ? lines.join(' ') : 'Lupaus, sinetti ja askeleet ovat ajan tasalla. Hyvää viikonloppua, sankari!',
      },
      [id],
    );
  }
  return { sent, skipped: null };
}
