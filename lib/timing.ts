import 'server-only';

// Palvelininstanssin käynnistyshetki: ensimmäinen pyyntö uudessa instanssissa on kylmäkäynnistys.
const bootAt = Date.now();
let served = 0;

/** Pyynnön alku ajanmittausta varten (vain ylläpitäjän nopeusmittari). */
export function requestStart() {
  const cold = served === 0;
  served++;
  return { t0: Date.now(), cold, uptimeS: Math.round((Date.now() - bootAt) / 1000) };
}

export type ServerTiming = { cold: boolean; uptimeS: number; queriesMs: number; computeMs: number; totalMs: number };
