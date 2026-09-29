/** Hiljaiset tunnit: klo 22–09 Suomen aikaa ilmoituksia ei lähetetä, vaan ne lähtevät aamulla klo 9. */
export const QUIET_START = 22;
export const QUIET_END = 9;

export function helsinkiHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: 'numeric', hourCycle: 'h23' }).format(d));
}

export function isQuietHour(hour = helsinkiHour()) {
  return hour >= QUIET_START || hour < QUIET_END;
}
