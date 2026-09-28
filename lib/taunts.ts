// Monsterin repliikit: täyden HP:n uhkailu ja reaktiot omaan iskuun. Ylläpidon omat rivit menevät oletusten edelle.

const FULL = 'Tulkaa vain, sankarit. Olen odottanut teitä.';
const HIT = ['Auts!', 'Tuoko oli kaikki?', 'Kutittaa.', 'Hmph. Ensi kerralla kovempaa.', 'Tuo tuntui… hieman.', 'Uskallatkin!'];
const CRIT = 'AARGH! Mistä tuo tuli?!';

export function fullTaunt(custom?: string | null) {
  return custom?.trim() || FULL;
}

/** Arpoo reaktion omaan iskuun. Kriittiselle iskulle oma rivi. Ylläpidon rivit (yksi per rivi) ohittavat oletukset. */
export function hitReaction(lines: string | null | undefined, critLine: string | null | undefined, crit: boolean) {
  if (crit) return critLine?.trim() || CRIT;
  const own = (lines ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const pool = own.length ? own : HIT;
  return pool[Math.floor(Math.random() * pool.length)];
}
