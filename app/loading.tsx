/** Näytetään heti sivua vaihdettaessa, kunnes palvelin on valmis. */
export default function Loading() {
  return (
    <>
      <div className="skeleton" style={{ height: 48 }} />
      <div className="loading-stage" role="status" aria-label="Ladataan">
        <div className="eyes" aria-hidden="true"><span /><span /></div>
      </div>
      <div className="skeleton" style={{ height: 60 }} />
      <div className="skeleton" style={{ height: 120 }} />
    </>
  );
}
