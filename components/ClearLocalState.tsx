'use client';
import { useEffect } from 'react';

/** Testidatan tyhjennyksen jälkeen: nollaa tämän laitteen animaatiomuisti (HP, paljastukset, kaatumiset, raportit). */
export default function ClearLocalState() {
  useEffect(() => {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('mj_')) localStorage.removeItem(key);
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, []);
  return null;
}
