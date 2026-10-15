import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Kuvien polut ovat aina uusia (aikaleima nimessä), joten muunnetun kuvan voi pitää välimuistissa 31 päivää.
  // Lyhyt välimuisti tekisi saman kuvan muunnoksen yhä uudelleen ja kuluttaisi Vercelin ilmaiskiintiötä (5 000 / kk).
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }], minimumCacheTTL: 2678400 },
  // Välilehtien välillä selain käyttää enintään 30 s vanhaa sivua, joten siirtymät ovat heti valmiita.
  // Omat kirjaukset päivittävät sivun heti (revalidatePath / router.refresh).
  // Etukäteen haetut välilehdet (alapalkin prefetch) kelpaavat 60 s; omat kirjaukset ja reaaliaikapäivitykset tyhjentävät välimuistin.
  experimental: { staleTimes: { dynamic: 30, static: 60 } },
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
