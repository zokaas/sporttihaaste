// Kohteen valinta (moniosainen monsteri): sankarin viimeksi valitsema osa muistetaan selaimessa viikoittain.
import { localKey } from './localKey';
import { helsinkiToday, seasonWeek } from './season';

const KEY = 'mj_target';
export const TARGET_EVENT = 'mj:target';

/** Valittu osa kuluvalla viikolla (null = ei valintaa, palvelin käyttää etummaista). */
export function readTarget(): number | null {
  try {
    const raw = localStorage.getItem(localKey(KEY));
    if (!raw) return null;
    const [w, i] = raw.split(':').map(Number);
    return w === seasonWeek(helsinkiToday()) && Number.isInteger(i) ? i : null;
  } catch {
    return null;
  }
}

export function writeTarget(index: number) {
  try {
    localStorage.setItem(localKey(KEY), `${seasonWeek(helsinkiToday())}:${index}`);
    window.dispatchEvent(new CustomEvent(TARGET_EVENT, { detail: index }));
  } catch {
    // Selaimen tallennus ei ole käytettävissä.
  }
}
