'use client';
import { useEffect, useState } from 'react';

/** Linkin jako WhatsAppiin tai kopiointi: osoite muodostetaan selaimessa sivuston omasta osoitteesta. */
export default function ShareLink({ path, text }: { path: string; text: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(new URL(path, window.location.origin).toString()), [path]);
  const message = `${text}\n${url}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="row">
      <a className="btn grow" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Jaa WhatsAppiin</a>
      <button type="button" className="btn btn-ghost grow" onClick={copy}>{copied ? '✓ Kopioitu' : 'Kopioi linkki'}</button>
    </div>
  );
}
