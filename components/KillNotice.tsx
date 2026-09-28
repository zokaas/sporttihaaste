'use client';
import { useEffect, useState } from 'react';

/** Ilmoitus, kun monstereita on kaatunut edellisen käynnin jälkeen. */
export default function KillNotice({ killed, names }: { killed: number; names: string[] }) {
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    try {
      const last = localStorage.getItem('mj_killed');
      if (last !== null && killed > Number(last)) setFresh(names.slice(Number(last)));
      localStorage.setItem('mj_killed', String(killed));
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, [killed, names]);
  if (!fresh.length) return null;
  return <div className="fx-fell" role="status">💀 {fresh.join(' ja ')} kaatui! Sinetti täyttyi ja vahinko riitti.</div>;
}
