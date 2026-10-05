'use client';
import { useEffect, useState } from 'react';
import { localKey } from '@/lib/localKey';
import { release, requestTurn } from '@/lib/overlayQueue';

type Kill = { week: number; name: string; image: string | null; images?: string[]; blow: string | null; killedAt?: number };

type Options = {
  /** Muistin avain: montako kaatoa on jo nähty (portinvartijalla oma). */
  storageKey?: string;
  /** Näytetäänkö ruutu myös ensimmäisellä käynnillä (portinvartija: kaatuminen näytetään aina kerran). */
  showFirst?: boolean;
  /** Yläotsikko ja selitys (oletus: viikko ja sinettiteksti). */
  label?: string;
  note?: string;
  /** Näytettävän viikkoraportin viikon loppu (ms): sen jälkeen tapahtunut kaatuminen näytetään raportin jälkeen. */
  recapEndMs?: number;
};

/** Iso kaatumisruutu, kun monstereita on kaatunut edellisen käynnin jälkeen. Napautus sulkee. */
export default function KillFinale({ killed, kills, storageKey = 'mj_killed', showFirst = false, label, note, recapEndMs }: { killed: number; kills: Kill[] } & Options) {
  const [fresh, setFresh] = useState<Kill[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const key = localKey(storageKey);
      const stored = localStorage.getItem(key);
      const last = stored ?? (showFirst ? '0' : null);
      if (last !== null && killed > Number(last)) {
        const shown = kills.slice(Number(last));
        setFresh(shown);
        // Aikajärjestys: raportin viikon jälkeen tapahtunut kaatuminen (rästi uudella viikolla) raportin jälkeen.
        const latest = shown[shown.length - 1]?.killedAt ?? 0;
        requestTurn('kill', recapEndMs && latest > recapEndMs ? 3 : 1, () => setOpen(true));
      }
      localStorage.setItem(key, String(killed));
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, [killed, kills, storageKey, showFirst, recapEndMs]);
  if (!open || !fresh.length) return null;
  const k = fresh[fresh.length - 1];
  return (
    <div className="finale" role="dialog" aria-label={`${k.name} kaatui`} onClick={() => { setOpen(false); release('kill'); }}>
      <div className="finale-body">
        {k.images && k.images.length > 1 ? (
          // Kaksikko tai kolmikko: kaikki osat murenevat yhdessä
          <div className="finale-group">{k.images.map((src) => <img key={src} className="finale-img" src={src} alt="" />)}</div>
        ) : k.image ? <img className="finale-img" src={k.image} alt="" /> : <div className="finale-img finale-skull">💀</div>}
        <div className="finale-ash" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ left: `${8 + ((i * 37) % 84)}%`, animationDelay: `${0.9 + (i % 6) * 0.18}s`, ['--drift' as string]: `${((i * 53) % 60) - 30}px` }} />
          ))}
        </div>
      </div>
      <div className="finale-text">
        <span>{label ?? `Viikko ${k.week}`}</span>
        <strong className="display">{fresh.map((x) => x.name).join(' ja ')}</strong>
        <em>KAATUI</em>
        {k.blow ? <p>Viimeinen isku: {k.blow}</p> : null}
        <p className="muted small">{note ?? 'Sinetti täyttyi ja monsteri kaatui. Ylijäämävoima jatkaa seuraavaan monsteriin tai ensi-iskuun.'}</p>
        <button type="button" className="btn btn-ghost">Jatka taistelua</button>
      </div>
    </div>
  );
}
