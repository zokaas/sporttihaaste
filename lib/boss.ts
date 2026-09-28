// Loppupomon läsnäolo kauden aikana: kuiskaukset kaatuneiden monsterien jälkeen ja kasvava varjo.
import { BOSS_WEEK } from './season';

/** Oletuskuiskaukset viikoille 1–11, jos ylläpito ei ole kirjoittanut omaa. Uhka kasvaa kauden mittaan. */
const WHISPERS = [
  'Yksi palvelijoistani vähemmän. Minä odotan.',
  'Nautitte voitoistanne. Hyvä. Se tekee lopusta makeamman.',
  'Kuulen askeleenne. Ne eivät kanna tänne asti.',
  'Jokainen kaatunut tekee minusta vain kärsimättömämmän.',
  'Kolme kerralla? Viihdyttävää. Minä en jaa voimaani kenenkään kanssa.',
  'Te hikoilette. Minä kasvan.',
  'Unessanikin kuulen sydämenne hakkaavan.',
  'Puolet palvelijoistani on poissa. En tarvinnut heitä.',
  'Maa alkaa jo halkeilla. Tunnetteko sen?',
  'Vielä yksi. Sitten on minun vuoroni.',
  'Riittää leikki. Minä herään.',
];

export function bossWhisper(week: number, custom?: string | null) {
  if (week < 1 || week >= BOSS_WEEK) return null;
  return custom?.trim() || WHISPERS[week - 1] || WHISPERS[0];
}

/** Varjon koko ja silmien kirkkaus 0…1 kauden viikon mukaan: viikolla 11 se täyttää kortin. */
export function bossGrowth(week: number) {
  if (week >= BOSS_WEEK - 1) return 1;
  return Math.max(0, Math.min(1, (week - 1) / (BOSS_WEEK - 2)));
}

/** Bestiaarion teksti ennen heräämistä. */
export function bossStirring(week: number) {
  if (week >= BOSS_WEEK - 1) return 'Se on heräämässä. Maa tärisee jo.';
  if (week >= 8) return 'Se kääntyy unissaan. Silmät raottuvat.';
  if (week >= 4) return 'Se nukkuu, mutta hengitys syvenee.';
  return 'Se nukkuu vielä.';
}
