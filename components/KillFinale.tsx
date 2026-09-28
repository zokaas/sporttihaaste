'use client';
import { useEffect, useState } from 'react';

type Kill = { week: number; name: string; image: string | null; blow: string | null };

/** Iso kaatumisruutu, kun monstereita on kaatunut edellisen käynnin jälkeen. Napautus sulkee. */
export default function KillFinale({ killed, kills }: { killed: number; kills: Kill[] }) {
  const [fresh, setFresh] = useState<Kill[]>([]);
  useEffect(() => {
    try {
      const last = localStorage.getItem('mj_killed');
      if (last !== null && killed > Number(last)) setFresh(kills.slice(Number(last)));
      localStorage.setItem('mj_killed', String(killed));
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, [killed, kills]);
  if (!fresh.length) return null;
  const k = fresh[fresh.length - 1];
  return (
    <div className="finale" role="dialog" aria-label={`${k.name} kaatui`} onClick={() => setFresh([])}>
      <div className="finale-body">
        {k.image ? <img className="finale-img" src={k.image} alt="" /> : <div className="finale-img finale-skull">💀</div>}
        <div className="finale-ash" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ left: `${8 + ((i * 37) % 84)}%`, animationDelay: `${0.9 + (i % 6) * 0.18}s`, ['--drift' as string]: `${((i * 53) % 60) - 30}px` }} />
          ))}
        </div>
      </div>
      <div className="finale-text">
        <span>Viikko {k.week}</span>
        <strong className="display">{fresh.map((x) => x.name).join(' ja ')}</strong>
        <em>KAATUI</em>
        {k.blow ? <p>Viimeinen isku: {k.blow}</p> : null}
        <p className="muted small">Sinetti täyttyi ja monsteri kaatui. Ylijäämävoima jatkaa seuraavaan monsteriin tai pottiin.</p>
        <button type="button" className="btn btn-ghost">Jatka taistelua</button>
      </div>
    </div>
  );
}
