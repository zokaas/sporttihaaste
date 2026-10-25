import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { choosesTarget, loadBattle } from './battle';
import { sealView } from './rules';
import { stageParts } from './trio';
import { hitReaction, lineText, stageHitLine } from './taunts';
import { BOSS_WEEK, isGateDay } from './season';
import { monsterImageUrl } from './supabase/client';

export type StrikeSummary = { name: string; image: string | null; hp: number; maxHp: number; reaction: string } | null;

/** Nykyisen vastustajan tilanne juuri tehdyn kirjauksen jälkeen: näytetään pienessä iskuikkunassa. */
export async function strikeSummary(supabase: SupabaseClient, today: string, aim: number | null = null): Promise<StrikeSummary> {
  const b = await loadBattle(supabase, today);
  // Portinvartijan päivinä iskut osuvat portinvartijaan.
  if (isGateDay(today)) {
    return { name: b.gate.name, image: monsterImageUrl(b.gate.image_path), hp: b.gate.left, maxHp: b.gate.hp, reaction: b.gate.killed ? 'Portti on auki!' : hitReaction(null, null, false) };
  }
  const target = b.ledger?.alive[0];
  if (!target) return null;
  const m = b.monsters.get(target.week);
  const view = sealView(target, b.required);
  // Kaksikko ja kolmikko: iskuikkunassa lyöty osa (kohteen valinta) tai etummainen elossa oleva.
  const parts = stageParts(m, view.hp, false, monsterImageUrl, choosesTarget(m) ? target.parts : null);
  const part = parts ? (aim != null && parts[aim] && !parts[aim].dead ? parts[aim] : parts.find((x) => !x.dead)) : null;
  return {
    name: part?.name ?? m?.name ?? (target.week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${target.week} monsteri`),
    image: part?.image ?? monsterImageUrl(m?.image_path),
    hp: part ? part.left : view.hp,
    maxHp: part ? part.hp : m?.hp ?? 1,
    // Kohteen valinnassa vastaa lyöty osa.
    reaction: lineText(choosesTarget(m) && target.parts ? stageHitLine(m, view.hp, false, 0, target.parts.map((x) => x.dead), aim) : stageHitLine(m, view.hp, false)),
  };
}
