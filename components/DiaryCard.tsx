import { formatDay } from '@/lib/season';
import type { DiaryEntry } from '@/lib/diary';

/** Päiväkirja taistelusivulla: tämän päivän merkintä auki, aiemmat (saman viikon) taitettuina. */
export default function DiaryCard({ entries, today }: { entries: DiaryEntry[]; today: string }) {
  const [first, ...rest] = entries;
  return (
    <section className="card diary">
      <span className="stage-week">📜 {first.day === today ? 'Päiväkirja · tänään' : `Päiväkirja · ${formatDay(first.day)}`}</span>
      {first.title ? <h2 className="display" style={{ margin: 0 }}>{first.title}</h2> : null}
      <p className="diary-body">{first.body}</p>
      {rest.length ? (
        <details>
          <summary className="muted small">Aiemmat merkinnät ({rest.length})</summary>
          {rest.map((e) => (
            <div key={e.day} className="diary-old">
              <span className="muted small">{formatDay(e.day)}{e.title ? ` · ${e.title}` : ''}</span>
              <p className="diary-body">{e.body}</p>
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}
