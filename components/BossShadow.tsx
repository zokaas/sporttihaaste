/** growth 0…1: varjo kasvaa ja silmät kirkastuvat kauden edetessä (oletus täysi koko). */
export default function BossShadow({ children, growth }: { children?: React.ReactNode; growth?: number }) {
  const g = growth ?? 1;
  const scale = 0.55 + 0.45 * g;
  return (
    <section className={`boss${growth != null && growth >= 1 ? ' boss-near' : ''}`} aria-label="Loppupomo">
      <svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <ellipse cx="195" cy="270" rx="220" ry="50" fill="#3a2a26" style={{ filter: 'blur(22px)' }} />
        <g style={{ transform: `scale(${scale})`, transformOrigin: '50% 100%' }}>
        <g className="body">
          <path
            d="M70 300 C80 215 125 170 158 156 C140 120 126 76 104 30 C146 60 166 100 176 138 C186 134 204 134 214 138 C224 100 244 60 286 30 C264 76 250 120 232 156 C265 170 310 215 320 300 Z"
            fill="#050303"
            style={{ filter: 'blur(7px)' }}
          />
        </g>
        <g style={{ opacity: 0.35 + 0.65 * g }}>
        <g className="eyes">
          <ellipse cx="180" cy="176" rx="9" ry="3.5" fill="#ff4a2e" style={{ filter: 'drop-shadow(0 0 8px #ff4a2e)' }} />
          <ellipse cx="210" cy="176" rx="9" ry="3.5" fill="#ff4a2e" style={{ filter: 'drop-shadow(0 0 8px #ff4a2e)' }} />
        </g>
        </g>
        </g>
      </svg>
      {children ? <div className="shade">{children}</div> : null}
    </section>
  );
}
