// Moniosainen monsteri (kaksikko tai kolmikko): osat jakavat viikon HP:n tasan ja kaatuvat järjestyksessä.
import type { Category } from './rules';

export type MonsterPart = { name: string; description?: string | null; weakness?: Category | null; image_path?: string | null };

/** Osien HP:t: tasajako, jakojäännös viimeiselle. */
export function partHps(total: number, count: number) {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? total - base * (count - 1) : base));
}

/**
 * Osien tila tehdyn vahingon mukaan. Kaksi ensimmäistä kaatuvat pelkällä vahingolla;
 * viimeinen kaatuu vasta, kun koko viikon monsteri kaatuu (sinetti täynnä).
 */
export function partStates(total: number, hpLeft: number, count: number, killed: boolean) {
  const hps = partHps(total, count);
  const dealt = total - Math.max(0, hpLeft);
  let before = 0;
  return hps.map((hp, i) => {
    const taken = Math.min(hp, Math.max(0, dealt - before));
    before += hp;
    const last = i === count - 1;
    const dead = last ? killed : taken >= hp;
    return { hp, left: hp - taken, dead };
  });
}

/** Viikon heikkoudet: kolmikolla kaikkien osien, muuten monsterin oma. */
export function weaknessesOf(m: { weakness?: Category | null; parts?: MonsterPart[] | null } | null | undefined): Category[] {
  if (m?.parts?.length) return [...new Set(m.parts.map((p) => p.weakness).filter(Boolean) as Category[])];
  return m?.weakness ? [m.weakness] : [];
}

/** Näyttämön osat: HP-tila ja kuva osittain. `image` muuntaa tallennuspolun osoitteeksi. */
export function stageParts(
  m: { hp?: number | null; parts?: MonsterPart[] | null } | null | undefined,
  hpLeft: number,
  killed: boolean,
  image: (path: string | null | undefined) => string | null,
) {
  if (!m?.parts?.length || !m.hp) return null;
  const states = partStates(m.hp, hpLeft, m.parts.length, killed);
  return m.parts.map((part, i) => ({ name: part.name, image: image(part.image_path), ...states[i] }));
}

/** "Kaksikko" tai "Kolmikko" osien määrän mukaan. */
export const groupName = (n: number) => (n === 2 ? 'Kaksikko' : n === 3 ? 'Kolmikko' : `${n} osaa`);
