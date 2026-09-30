'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Koko ruudun kuvanäkymä ilman mitään kuvan päällä. Napautus tai Esc sulkee.
 *  <dialog> nousee sivun päälle, vaikka jokin yläelementti olisi himmennetty. */
function Viewer({ images, onClose }: { images: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    d.showModal();
    return () => { document.body.style.overflow = overflow; if (d.open) d.close(); };
  }, []);

  return (
    <dialog ref={ref} className={`image-viewer${images.length > 1 ? ' is-many' : ''}`} aria-label="Kuva" onClick={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {images.map((src) => <img key={src} src={src} alt="" />)}
    </dialog>
  );
}

/** Kuva, joka aukeaa napautuksella koko ruudulle (full = isompi versio, oletuksena sama kuva). */
export function ZoomImg({ src, full, width, height, className, style }: { src: string; full?: string; width: number; height: number; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="zoom-img" onClick={() => setOpen(true)} aria-label="Avaa kuva">
        <img className={className} src={src} alt="" width={width} height={height} style={style} />
      </button>
      {open ? <Viewer images={[full ?? src]} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Nappi, joka avaa annetut kuvat koko ruudulle. */
export function ImageButton({ images, children }: { images: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!images.length) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-compact" onClick={() => setOpen(true)}>{children}</button>
      {open ? <Viewer images={images} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
