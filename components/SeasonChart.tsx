// Kauden käyrä: porukan viikkovoima (pylväät) ja viikon monsterin HP (viiva) rinnakkain.
// Yksi mittayksikkö ja yksi akseli; kuluvan viikon pylväs on himmeämpi, koska viikko on kesken.
type Row = { week: number; voima: number; hp: number | null; current: boolean };

const fmt = (n: number) => n.toLocaleString('fi-FI');

function niceMax(v: number) {
  const step = v > 20000 ? 5000 : v > 8000 ? 2000 : 1000;
  return Math.max(step, Math.ceil(v / step) * step);
}

export default function SeasonChart({ rows, bossWeek }: { rows: Row[]; bossWeek: number }) {
  const W = 340, H = 170, L = 38, R = 6, T = 8, B = 22;
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.voima, r.hp ?? 0)), 1));
  const slots = Math.max(rows.length, 6);
  const slot = (W - L - R) / slots;
  const barW = Math.min(24, slot * 0.6);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];

  return (
    <figure className="season-chart">
      <div className="chart-legend">
        <span><i className="swatch bar" /> Porukan voima viikossa</span>
        <span><i className="swatch line" /> Viikon monsterin HP</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Porukan voima ja monsterien HP viikoittain">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} className="tick" textAnchor="end">{t >= 1000 ? `${fmt(t / 1000)} k` : fmt(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + slot * i + slot / 2;
          const top = y(r.voima);
          const h = Math.max(0, H - B - top);
          const rad = Math.min(4, h);
          const x0 = cx - barW / 2;
          return (
            <g key={r.week} className="chart-col">
              <title>{`Viikko ${r.week}${r.week === bossWeek ? ' (loppupomo)' : ''}: voima ${fmt(r.voima)}${r.hp ? `, monsterin HP ${fmt(r.hp)}` : ''}${r.current ? ' – viikko kesken' : ''}`}</title>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} className="hit" />
              {h > 0 ? (
                <path
                  className={`bar${r.current ? ' current' : ''}`}
                  d={`M${x0},${H - B} V${top + rad} Q${x0},${top} ${x0 + rad},${top} H${x0 + barW - rad} Q${x0 + barW},${top} ${x0 + barW},${top + rad} V${H - B} Z`}
                />
              ) : null}
              {r.hp ? <line x1={cx - slot * 0.42} x2={cx + slot * 0.42} y1={y(r.hp)} y2={y(r.hp)} className="hpline" /> : null}
              <text x={cx} y={H - 6} className="tick" textAnchor="middle">{r.week === bossWeek ? '👑' : r.week}</text>
            </g>
          );
        })}
      </svg>
      <details>
        <summary className="muted small">Näytä taulukkona</summary>
        <table className="plain">
          <thead><tr><th>Viikko</th><th>Voima</th><th>HP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week}><td>{r.week === bossWeek ? 'Loppupomo' : r.week}{r.current ? ' (kesken)' : ''}</td><td>{fmt(r.voima)}</td><td>{r.hp ? fmt(r.hp) : '–'}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
