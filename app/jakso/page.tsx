import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import BackButton from '@/components/BackButton';
import Episode from '@/components/Episode';
import { requireHero } from '@/lib/page';
import { midseason } from '@/lib/midseason';
import { GATE_START } from '@/lib/season';
import { avatarUrl, monsterImageUrl, resizedImage } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/** Sarjakuvajakso puolivälistä: portti, iskut, kaatuneet, partiot, lupaukset, nykyinen taistelu ja loppupomon varjo. */
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
  // Tämän viikon monsteri näkyy jo etusivulla, joten sen kuva ei ole spoileri. Tulevia ei käytetä.
  const cur = m.standing.find((s) => s.current) ? b.monsters.get(m.started) : null;
  const curImage = cur ? cur.image_path ?? cur.parts?.find((x) => x.image_path)?.image_path ?? null : null;
  const [, gm, gd] = GATE_START.split('-').map(Number);
  return (
    <>
      <Nav current="/" />
      <BackButton fallback="/" />
      <h1 className="display">🎬 Jakso {m.started}: Puolivälin taisto</h1>
      <Episode d={{
        episode: m.started,
        heroes,
        me: user.id,
        gateDay: `${gd}.${gm}.`,
        fallen: m.story.fallen.map((f) => ({ name: f.name, image: img(f.image), blow: f.blow })),
        current: cur ? { name: m.standing.find((s) => s.current)!.name, image: img(curImage) } : null,
        week: m.started,
        overdue: m.standing.filter((s) => !s.current).length,
        biggest: m.story.biggest,
        together: m.story.together,
        trainings: m.trainings,
        stepDays: m.stepDays,
        patrols: m.patrols,
        jointTrainings: m.jointTrainings,
        kept: m.pledgesKept,
        pledges: m.pledgesTotal,
        damage: m.damage,
        pot: m.pot,
        daysLeft: m.daysLeft,
      }} />
    </>
  );
}
