import 'server-only';
import { cookies } from 'next/headers';
import { helsinkiToday, SEASON_START } from './season';

export const TEST_DAY_COOKIE = 'mj_testipaiva';

/**
 * Palvelimen "tänään" Suomen aikaa. Ylläpitäjä voi ennen kauden alkua asettaa testipäivän (eväste),
 * jolloin sovellus toimii kuin se päivä olisi tänään. Tietokanta päästää ylläpitäjän kirjaukset läpi
 * päivästä riippumatta; muiden kirjaukset tarkistetaan aina oikeaa päivää vasten.
 * MJ_TODAY on vain paikalliseen kehitykseen.
 */
export function today() {
  if (process.env.MJ_TODAY) return process.env.MJ_TODAY;
  const real = helsinkiToday();
  const test = cookies().get(TEST_DAY_COOKIE)?.value;
  if (test && /^\d{4}-\d{2}-\d{2}$/.test(test) && real < SEASON_START) return test;
  return real;
}

export function testDay() {
  const t = today();
  return t !== helsinkiToday() && !process.env.MJ_TODAY ? t : null;
}
