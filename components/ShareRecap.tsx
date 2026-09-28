'use client';
import { useState } from 'react';

/** Raportin kopiointi ja jako WhatsAppiin. */
export default function ShareRecap({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="row">
      <a className="btn grow" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <button type="button" className="btn btn-ghost grow" onClick={copy}>{copied ? '✓ Kopioitu' : 'Kopioi teksti'}</button>
    </div>
  );
}
