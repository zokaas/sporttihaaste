import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
  // Selain ei näytä välimuistista vanhaa sivua: iskut, askeleet ja ylläpidon muutokset näkyvät heti.
  experimental: { staleTimes: { dynamic: 0 } },
};

export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
      throw new Error(`Ympäristömuuttujat puuttuvat: ${missing.join(', ')}. Lisää ne Vercelissä (Settings → Environment Variables) sekä Production- että Preview-ympäristöön.`);
    }
  }
  return nextConfig;
}
