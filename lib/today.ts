import 'server-only';
import { cookies } from 'next/headers';
import { helsinkiToday, SEASON_START } from './season';

export const TEST_DAY_COOKIE = 'mj_testipaiva';
/** Testitilassa aiemmat viikot kaadetaan automaattisesti (vain ylläpitäjän oma näkymä). */
export const TEST_SKIP_COOKIE = 'mj_testi_kaada';

/**
 * Palvelimen "tänään" Suomen aikaa. Ylläpitäjä voi asettaa testipäivän (eväste), jolloin sovellus näyttää
 * siltä kuin se päivä olisi tänään. Ennen kautta testipäivänä voi myös kirjata (tietokanta päästää
 * ylläpitäjän kirjaukset läpi); kauden aikana testipäivä on pelkkä esikatselu (previewOnly), koska
 * kirjaukset menisivät oikeaan peliin. MJ_TODAY on vain paikalliseen kehitykseen.
 */
export function today() {
  if (process.env.MJ_TODAY) return process.env.MJ_TODAY;
  const real = helsinkiToday();
  const test = cookies().get(TEST_DAY_COOKIE)?.value;
  if (test && /^\d{4}-\d{2}-\d{2}$/.test(test)) return test;
  return real;
}

export function testDay() {
  const t = today();
  return t !== helsinkiToday() && !process.env.MJ_TODAY ? t : null;
}

/** Testitilan siirtymä millisekunteina (0, kun testitila ei ole päällä). */
export function testOffsetMs() {
  const t = testDay();
  if (!t) return 0;
  return Date.parse(`${t}T12:00:00Z`) - Date.parse(`${helsinkiToday()}T12:00:00Z`);
}

/** Kaadetaanko testitilassa aiemmat viikot automaattisesti. Ajastetuissa ajoissa ei ole evästeitä. */
export function testSkipPast() {
  try {
    return testDay() !== null && cookies().get(TEST_SKIP_COOKIE)?.value !== '0';
  } catch {
    return false;
  }
}

/** Kauden aikana testipäivä on pelkkä esikatselu: kirjaukset ja muistutukset estetään. */
export function previewOnly() {
  return helsinkiToday() >= SEASON_START && testDay() !== null;
}

export const PREVIEW_ERROR = 'Esikatselutila on päällä, joten kirjaukset eivät ole käytössä. Lopeta testitila ylläpidosta.';
