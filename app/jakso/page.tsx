import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import BackButton from '@/components/BackButton';
import Episode from '@/components/Episode';
import { requireHero } from '@/lib/page';
import { midseason } from '@/lib/midseason';
import { avatarUrl, monsterImageUrl, resizedImage } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/** Sarjakuvajakso puolivälistä: sankarit omilla avatareillaan, kaatuneet monsterit ja loppupomon varjo. */
export default async function Jakso() {
  const { battle: b, me, user } = await requireHero();
  const m = midseason(b, Boolean(me.is_admin), user.id);
  if (!m) notFound();
  const img = (path: string | null) => { const u = path ? monsterImageUrl(path) : null; return u ? resizedImage(u, 384) : null; };
  const heroes = b.participants.map((id) => {
    const h = b.heroes.find((x) => x.id === id);
    const a = avatarUrl(h?.avatar_path ?? null);
    return { id, name: h?.hero_name ?? '?', avatar: a ? resizedImage(a, 128) : null };
  });
  return (
    <>
      <Nav current="/" />
      <BackButton fallback="/" />
      <h1 className="display">🎬 Jakso {m.started}: Puolivälin sumu</h1>
      <Episode d={{
        episode: m.started,
        heroes,
        me: user.id,
        fallen: m.story.fallen.map((f) => ({ name: f.name, image: img(f.image) })),
        current: m.standing.find((s) => s.current)?.name ?? null,
        trainings: m.trainings,
        stepDays: m.stepDays,
        damage: m.damage,
        pot: m.pot,
        daysLeft: m.daysLeft,
      }} />
    </>
  );
}
