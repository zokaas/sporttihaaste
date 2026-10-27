import { STEP_DAY_DAMAGE } from './rules';

type Router = { push: (href: string) => void; refresh: () => void };

/**
 * Oma isku (treeni tai askeleet): etusivun alkuun, jossa monsteri ottaa iskun vastaan lentävänä lukuna.
 * Jos ollaan jo etusivulla, sivu vieritetään ylös (polku ei vaihdu, joten vierityksen muisti ei tee sitä).
 */
export function goStrike(router: Router, query: string) {
  router.push(`/?${query}`);
  if (window.location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
  router.refresh();
}

/** Askelkuittauksen isku etusivulle (kohteen valinnassa osa mukaan). */
export const stepStrikeQuery = (target: number | null) => `isku=${STEP_DAY_DAMAGE}&askel=1${target != null ? `&kohde=${target}` : ''}`;
