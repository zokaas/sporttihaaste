'use client';
import { useState, type ReactNode } from 'react';

/** Välilehdet samalle paikalle (Minä-sivu armonaikana: edellinen ja kuluva viikko). Ensimmäinen on oletuksena auki. */
export default function WeekTabs({ tabs }: { tabs: { label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="week-tabs">
      <div className="week-tabbar" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.label} type="button" role="tab" aria-selected={i === active} className={i === active ? 'on' : ''} onClick={() => setActive(i)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => <div key={t.label} role="tabpanel" hidden={i !== active}>{t.content}</div>)}
    </div>
  );
}
