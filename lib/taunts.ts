// Monsterin repliikit: täyden HP:n uhkailu ja reaktiot omaan iskuun. Ylläpidon omat rivit menevät oletusten edelle.
// Kaksikolla ja kolmikolla jokaisella osalla voi olla omat repliikit; kaatunut osa vaikenee.
import { partStates, type MonsterPart } from './trio';

const FULL = 'Tulkaa vain, sankarit. Olen odottanut teitä.';
const HIT = ['Auts!', 'Tuoko oli kaikki?', 'Kutittaa.', 'Hmph. Ensi kerralla kovempaa.', 'Tuo tuntui… hieman.', 'Uskallatkin!'];
const CRIT = 'AARGH! Mistä tuo tuli?!';
const HALF = 'Tuo sattui. Mutta pelkkä naarmu, sankarit!';
const LOW = 'Ei… ei vielä… minä en kaadu näin helposti!';
const BACKLOG = 'Ette saaneet minua kaatumaan. Minä jatkan.';

/** Puhekupla: puhuja (osan nimi) ja teksti. Ilman puhujaa monsteri puhuu yhtenä. */
export type Line = { who: string | null; text: string };

type Lines = { taunt_backlog?: string | null; taunt_full?: string | null; taunt_half?: string | null; taunt_low?: string | null; hit_lines?: string | null; hit_crit?: string | null };
type Speaker = Lines & { hp?: number | null; parts?: MonsterPart[] | null };

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const rows = (s?: string | null) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

export function fullTaunt(custom?: string | null) {
  return custom?.trim() || FULL;
}

/** Arpoo reaktion omaan iskuun. Kriittiselle iskulle oma rivi. Ylläpidon rivit (yksi per rivi) ohittavat oletukset. */
export function hitReaction(lines: string | null | undefined, critLine: string | null | undefined, crit: boolean) {
  if (crit) return critLine?.trim() || CRIT;
  const own = rows(lines);
  return pick(own.length ? own : HIT);
}

/** Puhekupla tekstinä (pieni iskuikkuna): "Porilainen: Lisää kaasua!". */
/** Osan kaatumisrepliikki (seuraavan osan suusta), tai null. */
export function fallLine(parts: MonsterPart[] | null | undefined, i: number): Line | null {
  const text = parts?.[i]?.fall_line?.trim();
  return text && parts![i + 1] ? { who: parts![i + 1].name, text } : null;
}

export const lineText = (l: Line) => (l.who ? `${l.who}: ${l.text}` : l.text);

/** Osat tilanteessa, jossa monsterilla on `hpLeft` HP:ta jäljellä (kaatunut-tieto mukana). */
function partsAt(m: Speaker, hpLeft: number) {
  if (!m.parts?.length || !m.hp) return null;
  const states = partStates(m.hp, hpLeft, m.parts.length, false);
  return m.parts.map((p, i) => ({ ...p, dead: states[i].dead }));
}

/**
 * Näyttämön repliikit HP:n mukaan: täysi (≥ 90 %), alle 50 % ja alle 20 %. Rästiin jäänyt monsteri sanoo
 * rästirepliikin (paitsi alle 50 %:ssa). Moniosaisella elossa olevat osat puhuvat omat repliikkinsä; jos osalla
 * ei ole omaa, käytetään yhteistä (tai oletusta). Jos elossa olevilla ei ole omaa repliikkiä, viimeksi kaatuneen
 * osan kaatumisrepliikki näkyy seuraavan osan suusta.
 */
export function stageTaunt(m: Speaker | undefined, hpLeft: number, backlog = false): Line[] | null {
  if (!m) return null;
  const share = m.hp ? hpLeft / m.hp : 1;
  let band: keyof Lines | null = share < 0.2 ? 'taunt_low' : share < 0.5 ? 'taunt_half' : share >= 0.9 ? 'taunt_full' : null;
  if (backlog && band !== 'taunt_low' && band !== 'taunt_half') band = 'taunt_backlog';
  const fallback = band === 'taunt_low' ? LOW : band === 'taunt_half' ? HALF : band === 'taunt_backlog' ? BACKLOG : FULL;
  const parts = partsAt(m, hpLeft);
  const own = parts && parts.some((p) => p.taunt_full || p.taunt_half || p.taunt_low || p.taunt_backlog || p.fall_line);
  if (!parts || !own) return band ? [{ who: null, text: m[band]?.trim() || fallback }] : null;

  const alive = parts.filter((p) => !p.dead);
  const out: Line[] = band ? alive.filter((p) => p[band]?.trim()).map((p) => ({ who: p.name, text: p[band]!.trim() })) : [];
  if (out.length) return out;
  const fallen = parts.filter((p) => p.dead).pop();
  if (fallen?.fall_line?.trim() && alive[0]) return [{ who: alive[0].name, text: fallen.fall_line.trim() }];
  return band ? [{ who: null, text: m[band]?.trim() || fallback }] : null;
}

/**
 * Reaktio omaan iskuun. Moniosaisella arvotaan elossa oleva osa ja sen oma rivi (tai yhteinen, jos omaa ei ole).
 * Jos isku kaatoi osan, seuraava osa sanoo kaatumisrepliikin.
 */
export function stageHitLine(m: Speaker | undefined, hpLeft: number, crit: boolean, damage = 0): Line {
  const common = (): Line => ({ who: null, text: hitReaction(m?.hit_lines, m?.hit_crit, crit) });
  const parts = m ? partsAt(m, hpLeft) : null;
  if (!m || !parts) return common();
  const alive = parts.filter((p) => !p.dead);
  if (!alive.length) return common();
  if (damage > 0) {
    const before = partsAt(m, hpLeft + damage)!;
    const fell = parts.filter((p, i) => p.dead && !before[i].dead).pop();
    if (fell?.fall_line?.trim()) return { who: alive[0].name, text: fell.fall_line.trim() };
  }
  const speakers = alive.filter((p) => (crit ? p.hit_crit?.trim() : rows(p.hit_lines).length));
  if (!speakers.length) return common();
  const p = pick(speakers);
  return { who: p.name, text: crit ? p.hit_crit!.trim() : pick(rows(p.hit_lines)) };
}
