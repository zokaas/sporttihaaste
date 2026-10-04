'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { voteCheer } from '@/app/actions';

type Candidate = { id: string; name: string; avatar: string | null };

/** Viikon tsemppari -äänestys (su klo 17–23.59). Valinta tallentuu heti; ääntä voi vaihtaa. */
export default function CheerVote({ candidates, myVote }: { candidates: Candidate[]; myVote: string | null }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(myVote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function vote(id: string) {
    if (busy || id === chosen) return;
    setBusy(true);
    setError('');
    const prev = chosen;
    setChosen(id);
    const res = await voteCheer(id);
    setBusy(false);
    if (!res.ok) {
      setChosen(prev);
      return setError(res.error);
    }
    router.refresh();
  }

  return (
    <section className="card threat">
      <h2 className="display">🙌 Viikon tsemppari</h2>
      <p style={{ margin: 0 }}>Kuka tsemppasi, kannusti tai inspiroi tällä viikolla? Äänestys on auki tänään klo 23.59 asti, ja tulos paljastuu maanantaina viikkoraportissa.</p>
      <div className="chips">
        {candidates.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={chosen === c.id} disabled={busy} onClick={() => vote(c.id)}>
            {c.avatar ? <img className="avatar" src={c.avatar} alt="" width={22} height={22} /> : null}
            {c.name}
          </button>
        ))}
      </div>
      {chosen ? <p className="small ok" style={{ margin: 0 }}>Äänesi: {candidates.find((c) => c.id === chosen)?.name}. Voit vielä vaihtaa.</p> : null}
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
