'use client';
import { useEffect, useState } from 'react';

/** "↑ Ylös"-nappi pitkillä sivuilla: näkyy, kun sivua on vieritetty reilusti alas. */
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button type="button" className="scroll-top" aria-label="Sivun alkuun" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      ↑ Ylös
    </button>
  );
}
