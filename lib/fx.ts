/** Monsterin erikoisefekti (migraatio 035): emojit ja liiketyyli. Ylläpitäjä valitsee monsterieditorissa. */
export type FxStyle = 'float' | 'puff' | 'rain' | 'shake';
export type MonsterFx = { emoji: string; style: FxStyle };

export const FX_STYLES: { id: FxStyle; label: string }[] = [
  { id: 'float', label: 'Leijuu ylöspäin (savu, kuplat, kuitit)' },
  { id: 'puff', label: 'Tuprahtaa pilvinä (pierut, pöly)' },
  { id: 'rain', label: 'Sataa ylhäältä (lumi, rahat, lehdet)' },
  { id: 'shake', label: 'Karjaisee: kuva tärisee iskusta' },
];

/** Emojit yksitellen (myös yhdistelmäemojit kuten 🧑‍🚀 pysyvät ehjinä). */
export function fxEmojis(s: string | null | undefined): string[] {
  const text = (s ?? '').replace(/\s+/g, '');
  if (!text) return [];
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  const list = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (x) => x.segment) : Array.from(text);
  return list.slice(0, 6);
}

/** Tallennettu arvo turvallisesti: tuntematon tyyli tai tyhjä emoji → ei efektiä. */
export function parseFx(v: unknown): MonsterFx | null {
  if (!v || typeof v !== 'object') return null;
  const { emoji, style } = v as { emoji?: unknown; style?: unknown };
  if (typeof emoji !== 'string' || !fxEmojis(emoji).length) return null;
  return { emoji, style: FX_STYLES.some((x) => x.id === style) ? (style as FxStyle) : 'float' };
}
