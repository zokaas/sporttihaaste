/**
 * Supabasen kellojen ero: heti uusitun kirjautumisen tunnisteen myöntöaika (iat) voi olla tietokantapalvelimen
 * kellon mukaan muutaman sekunnin tulevaisuudessa, jolloin PostgREST hylkää pyynnön virheellä
 * "JWT issued at future" (PGRST303). Sama pyyntö menee läpi hetken päästä, joten se yritetään uudelleen.
 */
const SKEW_RETRY_MS = [500, 1000, 2000];

export const skewTolerantFetch: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 401 || attempt >= SKEW_RETRY_MS.length) return res;
    const body = await res.clone().text().catch(() => '');
    if (!body.includes('PGRST303') && !/issued at future/i.test(body)) return res;
    await new Promise((r) => setTimeout(r, SKEW_RETRY_MS[attempt]));
  }
};
