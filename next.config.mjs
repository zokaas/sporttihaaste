import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
  // Välilehtien välillä selain käyttää enintään 30 s vanhaa sivua, joten siirtymät ovat heti valmiita.
  // Omat kirjaukset päivittävät sivun heti (revalidatePath / router.refresh).
  experimental: { staleTimes: { dynamic: 30 } },
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
