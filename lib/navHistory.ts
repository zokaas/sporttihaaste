// Sovelluksen sisäinen siirtymähistoria: tiedetäänkö, että edellinen sivu on tässä sovelluksessa
// (takaisin-nappi), ja oliko viimeisin siirtymä taaksepäin (vierityskohdan palautus).
let inAppNavs = 0;
let lastPopAt = 0;

/** Kutsutaan jokaisella sivunvaihdolla ensimmäisen latauksen jälkeen. */
export const markNavigation = () => { inAppNavs++; };
/** Onko tähän sivuun tultu sovelluksen sisältä (eli takaisin vie sovelluksen sivulle). */
export const cameFromApp = () => inAppNavs > 0;
/** Selaimen tai takaisin-napin siirtymä taaksepäin. */
export const markPop = () => { lastPopAt = Date.now(); };
export const wasPop = () => Date.now() - lastPopAt < 1500;
