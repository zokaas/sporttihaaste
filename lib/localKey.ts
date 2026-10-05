/**
 * Selaimen "nähty"-muistin avain. Esikatselussa (ylläpidon testipäivä, eväste mj_testipaiva) käytetään omia
 * avaimia, jotta testitilassa nähdyt raportit, paljastukset ja kaatumiset eivät merkitse oikeita nähdyiksi.
 */
export function localKey(key: string) {
  try {
    return document.cookie.split('; ').some((c) => c.startsWith('mj_testipaiva=')) ? key.replace(/^mj_/, 'mj_test_') : key;
  } catch {
    return key;
  }
}
