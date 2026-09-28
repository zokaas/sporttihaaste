'use client';
import { useState } from 'react';

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 10 - 1930 + 1 }, (_, i) => THIS_YEAR - 10 - i);

type Props = {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  /** Jos annettu, näytetään myös vuoden valinta. */
  year?: number | null;
  onYearChange?: (y: number | null) => void;
};

/** Päivän ja kuukauden (ja valinnaisesti vuoden) valinta. Palauttaa muodon KK-PP tai null, jos jompikumpi puuttuu. */
export default function DayMonth({ label, value, onChange, year, onYearChange }: Props) {
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
        {onYearChange ? (
          <select className="input grow" aria-label={`${label}: vuosi`} value={year ?? ''} onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Vuosi</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : null}
      </div>
      {missing(m, d, onYearChange ? year : 0).length && (m || d || year) ? <span className="muted small">Valitse myös {missing(m, d, onYearChange ? year : 0).join(' ja ')}.</span> : null}
    </fieldset>
  );
}

function missing(m: string, d: string, year: number | null | undefined) {
  return [!d && 'päivä', !m && 'kuukausi', !year && 'vuosi'].filter(Boolean) as string[];
}
