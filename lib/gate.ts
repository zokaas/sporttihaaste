// Portinvartija: kauden avaava taistelu ti 29.9.–ke 30.9. Ei sinettiä: kaatuu, kun HP loppuu.
// Treenit ja askeleet lyövät. Jos se jää henkiin, jäljelle jäänyt HP siirtyy viikon 1 monsterille;
// jos se kaatuu, ylijäämä menee pottiin. Päivän treenit eivät kerry viikon 1 lupaukseen (viikko 0).
import { isGateDay } from './season.ts';
import { STEP_DAY_DAMAGE } from './rules.ts';

export const GATE_HP_DEFAULT = 1500;

export type GateRow = { name: string | null; description: string | null; image_path: string | null; hp: number | null; taunt: string | null };

/** Portinvartijan tilanne päivän iskuista ja askeleista. */
export function gateResult(row: GateRow | null, hits: { trained_on: string; damage: number }[], steps: { day: string }[]) {
  const hp = row?.hp && row.hp > 0 ? row.hp : GATE_HP_DEFAULT;
  const dealt = hits.filter((h) => isGateDay(h.trained_on)).reduce((a, h) => a + h.damage, 0)
    + steps.filter((s) => isGateDay(s.day)).length * STEP_DAY_DAMAGE;
  return {
    name: row?.name || 'Sauronin silmä',
    description: row?.description ?? null,
    image_path: row?.image_path ?? null,
    taunt: row?.taunt ?? null,
    hp,
    dealt,
    left: Math.max(0, hp - dealt),
    surplus: Math.max(0, dealt - hp),
    killed: dealt >= hp,
  };
}

export type Gate = ReturnType<typeof gateResult>;
