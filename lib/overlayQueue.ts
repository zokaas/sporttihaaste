/**
 * Taistelunäkymän isot ruudut (kaatuminen, viikkoraportti) yksi kerrallaan. Pienin `order` ensin; seuraava
 * aukeaa, kun edellinen vapautetaan. Jonon ollessa käytössä __mjModalOpen on tosi, jolloin uuden monsterin
 * paljastus odottaa ja saa 'mj:modal-closed'-tapahtuman, kun jono tyhjenee.
 */
type Entry = { id: string; order: number; grant: () => void };
type W = { __mjModalOpen?: boolean };

const pending: Entry[] = [];
let active: string | null = null;
let scheduled = false;

function setOpen(open: boolean) {
  (window as unknown as W).__mjModalOpen = open;
  if (!open) window.dispatchEvent(new Event('mj:modal-closed'));
}

function next() {
  if (active) return;
  pending.sort((a, b) => a.order - b.order);
  const e = pending.shift();
  if (!e) return setOpen(false);
  active = e.id;
  e.grant();
}

/** Pyydä vuoroa. Kaikki saman renderöinnin pyynnöt kerätään ennen kuin ensimmäinen aukeaa. */
export function requestTurn(id: string, order: number, grant: () => void) {
  if (active === id || pending.some((p) => p.id === id)) return;
  pending.push({ id, order, grant });
  (window as unknown as W).__mjModalOpen = true;
  window.dispatchEvent(new Event('mj:modal-open'));
  if (!scheduled && !active) {
    scheduled = true;
    setTimeout(() => { scheduled = false; next(); }, 0);
  }
}

/** Ruutu suljettiin: seuraava jonossa aukeaa. */
export function release(id: string) {
  const i = pending.findIndex((p) => p.id === id);
  if (i >= 0) pending.splice(i, 1);
  if (active === id) { active = null; next(); }
}

/** Onko jokin iso ruutu auki tai jonossa (pienemmät ilmoitukset jätetään silloin näyttämättä). */
export const overlayBusy = () => active !== null || pending.length > 0;
