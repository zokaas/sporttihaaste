'use client';
import { useEffect } from 'react';
import { reportClientError } from '@/app/errorActions';

const sent = new Set<string>();

/** Lähettää selaimen käsittelemättömät virheet ylläpidon virhelokiin (sama viesti kerran, enintään 5 per käynti). */
export function sendClientError(message: string, detail?: string) {
  const key = message.slice(0, 200);
  if (!message || sent.has(key) || sent.size >= 5) return;
  sent.add(key);
  void reportClientError(message, window.location.pathname + window.location.search, detail).catch(() => {});
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Selainlaajennusten ja muiden sivustojen skriptien virheet eivät ole sovelluksen vikoja.
      if (e.filename && !e.filename.startsWith(window.location.origin)) return;
      sendClientError(e.message, e.error instanceof Error ? e.error.stack : undefined);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      sendClientError(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
