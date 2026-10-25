'use client';
import type { Weakness } from '@/lib/rules';

/** Kohteen valinta: moniosaisen monsterin osa. */
export type TargetPart = { index: number; name: string; image: string | null; hp: number; weakness: Weakness | null; dead: boolean };

/** Osakortit, joista sankari valitsee lyötävän osan (kaatuneet harmaina, ei valittavissa). */
export default function TargetChoice({ targets, selected, onPick, disabled }: { targets: TargetPart[]; selected: number | null; onPick: (index: number) => void; disabled?: boolean }) {
  return (
    <div className="target-pick" role="group" aria-label="Valitse kohde">
      {targets.map((t) => (
        <button key={t.index} type="button" className={`target-card${t.index === selected ? ' sel' : ''}${t.dead ? ' dead' : ''}`} disabled={t.dead || disabled} aria-pressed={t.index === selected}
          onClick={() => onPick(t.index)}>
          {t.image ? <img src={t.image} alt="" /> : <b>{t.dead ? '✝' : t.name.slice(0, 1)}</b>}
          <span className="target-name">{t.name}</span>
          <span className="muted small">{t.dead ? 'Kaatunut' : `${t.hp.toLocaleString('fi-FI')} HP`}</span>
          {t.weakness && !t.dead ? <span className="small ok">{t.weakness}</span> : null}
        </button>
      ))}
    </div>
  );
}
