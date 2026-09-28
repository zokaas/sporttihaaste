import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import RecapCard from '@/components/RecapCard';
import ShareRecap from '@/components/ShareRecap';
import { requireHero } from '@/lib/page';
import { recapText, weekRecap } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default async function Raportti({ params }: { params: { week: string } }) {
  const { battle: b } = await requireHero();
  const r = weekRecap(b, Number(params.week));
  if (!r) notFound();
  const text = recapText(r);
  return (
    <>
      <Nav current="/" />
      <h1 className="display">Viikon {r.week} raportti</h1>
      <section className="card"><RecapCard r={r} /></section>
      <section className="card">
        <h2 className="display">Jaa porukalle</h2>
        <pre className="share-text">{text}</pre>
        <ShareRecap text={text} />
      </section>
    </>
  );
}
