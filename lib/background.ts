import 'server-only';
import { waitUntil } from '@vercel/functions';

/**
 * Ajetaan vastauksen jälkeen (ilmoitukset, kaatumistarkistus), jottei käyttäjän nappi odota niitä.
 * Vercel pitää funktion käynnissä, kunnes tehtävä on valmis.
 */
export function background(task: Promise<unknown>) {
  waitUntil(task.catch((e) => console.error('Taustatehtävä epäonnistui', e)));
}
