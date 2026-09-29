import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { SPORTS, type Category } from '@/lib/rules';
import { formatDay, loggableDays, monthDay, seasonWeek, weekRange, SEASON_START } from '@/lib/season';
import { today } from '@/lib/today';
import { monsterOfWeek } from '@/lib/battle';
import HitForm from '@/components/HitForm';
import DeleteHitButton from '@/components/DeleteHitButton';
import Hint from '@/components/Hint';
import { isSickOn, type SickPeriod } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

export default async function Kirjaa() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');

  const now = today();
  const days = loggableDays(now);
  if (days.length === 0) {
    return (
      <>
        <Link href="/" className="muted tap">← Takaisin</Link>
        <section className="card">
          <h1 className="display">Kirjaa treeni</h1>
          <p style={{ margin: 0 }}>{now < SEASON_START ? `Kausi alkaa ${formatDay(SEASON_START)} Silloin voit kirjata ensimmäiset iskut.` : 'Kausi on päättynyt.'}</p>
        </section>
      </>
    );
  }

  const week = seasonWeek(now);
  const { start, end } = weekRange(week);
  const [{ data: heroes }, monster, { data: myHits }, { data: sick }] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at, birthday, name_day').order('hero_name'),
    monsterOfWeek(supabase, week),
    supabase.from('hits').select('*').eq('user_id', user.id).gte('trained_on', start).lte('trained_on', end).order('trained_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('sick_periods').select('user_id, starts_on, ends_on'),
  ]);
  const participants = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const celebrations: Record<string, string[]> = {};
  for (const d of days) {
    const md = monthDay(d);
    celebrations[d] = participants.filter((h) => h.birthday === md || h.name_day === md).map((h) => h.hero_name ?? '');
  }
  const names = new Map(participants.map((h) => [h.id, h.hero_name ?? '']));
  // Koko porukka -bonukseen tarvitaan päivän terveet sankarit.
  const healthyByDay: Record<string, number> = {};
  for (const d of days) healthyByDay[d] = participants.filter((h) => !isSickOn((sick ?? []) as SickPeriod[], h.id, d)).length;

  return (
    <>
      <Link href="/" className="muted tap">← Takaisin</Link>
      <h1 className="display">Kirjaa treeni</h1>
      <HitForm
        days={days}
        sports={SPORTS}
        companions={participants.filter((h) => h.id !== user.id).map((h) => ({ id: h.id, name: h.hero_name ?? '', avatar: avatarUrl(h.avatar_path) }))}
        weakness={monster.weaknesses}
        celebrations={celebrations}
        healthyByDay={healthyByDay}
      />

      <section className="card">
        <h2 className="display">Iskusi viikolla {week}</h2>
        {(myHits ?? []).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Ei vielä iskuja tällä viikolla.</p>
        ) : (
          <ul className="people">
            {(myHits ?? []).map((h) => (
              <li key={h.id}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{h.sport} {formatMinutes(h.minutes)} <span className="ok">{h.damage}</span></div>
                  <div className="facts">
                    {formatDay(h.trained_on)}
                    {h.bonus_pct ? ` · bonus +${h.bonus_pct} %` : ''}
                    {h.companions.length ? ` · mukana ${h.companions.map((id: string) => names.get(id)).filter(Boolean).join(', ')}` : ''}
                  </div>
                </div>
                <DeleteHitButton id={h.id} />
              </li>
            ))}
          </ul>
        )}
        <Hint id="week-lock">Viikko lukittuu su {+end.slice(8, 10)}.{+end.slice(5, 7)}. klo 23.59. Sen jälkeen iskuja ei voi enää lisätä tai poistaa.</Hint>
      </section>
    </>
  );
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}
