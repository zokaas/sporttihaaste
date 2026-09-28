'use client';
import { useState } from 'react';

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

/** Päivän ja kuukauden valinta. Palauttaa muodon KK-PP tai null, jos jompikumpi puuttuu. */
export default function DayMonth({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  // Päivä ja kuukausi pidetään omassa tilassaan, jotta puolikas valinta ei katoa ennen kuin molemmat on valittu.
  const [m, setM] = useState(value ? value.split('-')[0] : '');
  const [d, setD] = useState(value ? value.split('-')[1] : '');
  const set = (mm: string, dd: string) => {
    setM(mm);
    setD(dd);
    onChange(mm && dd ? `${mm}-${dd}` : null);
  };
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <legend style={{ fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 6 }}>{label}</legend>
      <div className="row">
        <select className="input grow" aria-label={`${label}: päivä`} value={d} onChange={(e) => set(m, e.target.value)}>
          <option value="">Päivä</option>
          {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((x) => <option key={x} value={x}>{Number(x)}.</option>)}
        </select>
        <select className="input grow" aria-label={`${label}: kuukausi`} value={m} onChange={(e) => set(e.target.value, d)}>
          <option value="">Kuukausi</option>
          {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}kuu</option>)}
        </select>
      </div>
      {(m && !d) || (!m && d) ? <span className="muted small">Valitse myös {m ? 'päivä' : 'kuukausi'}.</span> : null}
    </fieldset>
  );
}
