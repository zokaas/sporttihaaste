import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBattle } from './battle';
import { sendPush } from './push';
import { STEP_GOAL } from './rules';
import { addDays, weekRange } from './season';
import { isSickOn } from './weekly';

const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;

/**
 * Viikkomuistutus: jokaiselle terveelle sankarille oma viesti siitä, mitä viikolta vielä puuttuu
 * (lupauksen tunnit, isku sinettiin, askelkuittaukset). Perjantaiaamuna ja sunnuntai-iltana.
 * Sunnuntaina viestiä ei lähetetä sille, jolla kaikki on kunnossa; perjantaina hänelle tulee kehu.
 * onlyUser: lähetä vain tälle sankarille (ylläpitäjän testi).
 */
export async function fridayReminders(supabase: SupabaseClient, day: string, onlyUser?: string, kind: 'friday' | 'sunday' = 'friday') {
  const b = await loadBattle(supabase, day);
  if (!b.ledger) return { sent: 0, skipped: 'Taistelu ei ole käynnissä.' };
  const target = b.ledger.alive[0];
  const monster = target ? b.monsters.get(target.week)?.name ?? 'monsteri' : null;
  const { start, end } = weekRange(b.week);
  let sent = 0;
  const people = b.participants.filter((id) => (!onlyUser || id === onlyUser) && !isSickOn(b.periods, id, day));
  for (const id of people) {
    const lines: string[] = [];
    const status = b.pledgeStatus(id, b.week);
    if (status.target > 0 && status.hours < status.target) lines.push(`Lupauksesta puuttuu ${h(status.target - status.hours)}.`);
    if (target && b.required.includes(id) && !target.hitters.includes(id)) {
      lines.push(target.padded ? `${monster} on sinettirajalla ja kaatuu heti, kun sinä lyöt!` : `Et ole vielä lyönyt viikon monsteria (${monster}), ja sinetti tarvitsee sinut.`);
    }
    // Sairaspäiviä ei lasketa puuttuviksi askelkuittauksiksi.
    let healthyDays = 0;
    for (let d = start; d <= day && d <= end; d = addDays(d, 1)) if (!isSickOn(b.periods, id, d)) healthyDays++;
    const steps = b.steps.filter((s) => s.user_id === id && s.day >= start && s.day <= day && !isSickOn(b.periods, id, s.day)).length;
    if (steps < healthyDays) lines.push(`Askelkuittauksia ${steps}/${healthyDays} (${STEP_GOAL.toLocaleString('fi-FI')} askelta = +50).`);
    // Sunnuntaina vain puuttuvista; perjantaina kaikki kunnossa oleville kehu.
    if (!lines.length && kind === 'sunday') continue;
    sent += await sendPush(
      supabase,
      {
        title: kind === 'sunday'
          ? `⏳ Viikko ${b.week} lukittuu ma klo 12`
          : lines.length ? `⚔️ Viikonloppu tulee – viikko ${b.week} päättyy sunnuntaina` : '⚔️ Kaikki kunnossa tällä viikolla!',
        body: lines.length
          ? `${lines.join(' ')}${kind === 'sunday' ? ' Kirjaa puuttuvat viimeistään ma klo 12.' : ''}`
          : 'Lupaus, sinetti ja askeleet ovat ajan tasalla. Hyvää viikonloppua, sankari!',
        ...(kind === 'sunday' ? { url: '/kirjaa' } : {}),
      },
      [id],
    );
  }
  return { sent, skipped: null };
}
