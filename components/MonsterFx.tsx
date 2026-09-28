'use client';
import { useEffect, useState } from 'react';

/**
 * Näyttää osuman (tärähdys ja punainen välähdys), kun monsterin HP on laskenut edellisestä käynnistä,
 * ja kaatumisilmoituksen, kun kaatuneita on tullut lisää. Vähennetty liike -asetus ohittaa animaatiot CSS:ssä.
 */
export default function MonsterFx({ week, hp, killed, children }: { week: number; hp: number; killed: number; children: React.ReactNode }) {
  const [hit, setHit] = useState(false);
  const [fell, setFell] = useState(false);

  useEffect(() => {
    try {
      const key = `mj_hp_${week}`;
      const last = Number(localStorage.getItem(key));
      if (last && hp < last) setHit(true);
      localStorage.setItem(key, String(hp));
      const lastKilled = localStorage.getItem('mj_killed');
      if (lastKilled !== null && killed > Number(lastKilled)) setFell(true);
      localStorage.setItem('mj_killed', String(killed));
    } catch {
      // Selaimen tallennus ei ole käytettävissä; animaatiot jäävät pois.
    }
  }, [week, hp, killed]);

  return (
    <div className={hit ? 'fx-hit' : undefined}>
      {fell ? <div className="fx-fell" role="status">💀 Monsteri kaatui! Sinetti täyttyi ja vahinko riitti.</div> : null}
      {children}
    </div>
  );
}
