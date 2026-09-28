// Supabase vaatii sähköpostin, joten käyttäjänimi muutetaan piilotetuksi osoitteeksi.
// Osoitteeseen ei lähetetä mitään, koska sähköpostivahvistus on pois päältä.
export const LOGIN_EMAIL_DOMAIN = 'monsterijahti.app';

export function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o');
}

export function isValidUsername(username: string) {
  return /^[a-z0-9._-]{3,20}$/.test(username);
}

export function usernameToEmail(username: string) {
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
