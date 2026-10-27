// Iskuikkunoissa (omat askeleet, muiden live-iskut, poissaolon kooste) jo näytetty vahinko. Etusivun
// näyttämö vähentää sen HP-palkin pudotuksesta, jottei sama isku näy kahdesti lentävänä lukuna.
import { localKey } from './localKey';

const KEY = 'mj_seen_damage';

export function addSeenDamage(damage: number) {
  try {
    const before = Number(localStorage.getItem(localKey(KEY)) ?? 0) || 0;
    localStorage.setItem(localKey(KEY), String(before + damage));
  } catch { /* ei tallennusta */ }
}

/** Palauttaa näytetyn vahingon ja nollaa sen. */
export function takeSeenDamage() {
  try {
    const seen = Number(localStorage.getItem(localKey(KEY)) ?? 0) || 0;
    localStorage.removeItem(localKey(KEY));
    return seen;
  } catch {
    return 0;
  }
}
