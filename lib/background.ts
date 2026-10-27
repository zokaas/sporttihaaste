import 'server-only';
import { waitUntil } from '@vercel/functions';
import { earlyRevealMs, seasonWeek } from './season';
import { today } from './today';

/**
 * Ajetaan vastauksen jälkeen (ilmoitukset, kaatumistarkistus), jottei käyttäjän nappi odota niitä.
 * Vercel pitää funktion käynnissä, kunnes tehtävä on valmis.
 */
export function background(task: Promise<unknown>) {
  waitUntil(task.catch((e) => console.error('Taustatehtävä epäonnistui', e)));
}

/**
 * Kirjauksen jälkitarkistus. Yleensä taustalla, mutta sunnuntaina ennakkopaljastuksen ajan (klo 19) jälkeen
 * odotetaan: kaato voi paljastaa seuraavan monsterin, ja kaatajan pitää nähdä se heti etusivulla.
 */
export async function afterLog(task: () => Promise<unknown>) {
  const week = seasonWeek(today());
  if (week >= 1 && Date.now() >= earlyRevealMs(week)) await task().catch((e) => console.error('Jälkitarkistus epäonnistui', e));
  else background(task());
}
