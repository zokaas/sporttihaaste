import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { SPECIAL_WEAKNESSES, type Category } from '@/lib/rules';
import { activeSports, loadSports } from '@/lib/sports';
import { addDays, formatDay, graceWeek, loggableDays, monthDay, seasonWeek, weekRange, SEASON_START } from '@/lib/season';
import { today } from '@/lib/today';
import { currentWeaknesses, loadBattle } from '@/lib/battle';
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
  // Armonaikana (ma klo 12 asti) myös edellisen viikon iskut näkyvät ja ovat poistettavissa.
  const grace = graceWeek(now);
  const start = weekRange(grace ?? week).start;
  const lockWeek = grace ?? week;
  const lockDay = addDays(weekRange(lockWeek).end, 1);
  const [{ data: heroes }, battle, { data: myHits }, { data: sick }, sports] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at, birthday, name_day').order('hero_name'),
    loadBattle(supabase, now),
    supabase.from('hits').select('*').eq('user_id', user.id).gte('trained_on', start).lte('trained_on', now).order('trained_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('sick_periods').select('user_id, starts_on, ends_on'),
    loadSports(supabase),
  ]);
  const participants = (heroes ?? []).filter((h) => h.pledge_locked_at);
  // Kela-iskut omilta sairaspäiviltä tällä viikolla (tulevat sairausmerkinnöistä, ei poistettavissa).
  const myKela = battle.kela.filter((k) => k.userId === user.id && k.day >= start && k.day <= now).sort((a, c) => c.day.localeCompare(a.day));
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
        sports={activeSports(sports)}
        companions={participants.filter((h) => h.id !== user.id).map((h) => ({ id: h.id, name: h.hero_name ?? '', avatar: avatarUrl(h.avatar_path) }))}
        weakness={currentWeaknesses(battle, week)}
        celebrations={celebrations}
        healthyByDay={healthyByDay}
      />

      <section className="card">
        <h2 className="display">{week === 0 ? 'Iskusi portinvartijaan' : grace ? `Iskusi viikoilla ${grace}–${week}` : `Iskusi viikolla ${week}`}</h2>
        {(myHits ?? []).length === 0 && myKela.length === 0 ? (
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
                    {h.special && SPECIAL_WEAKNESSES[h.special] ? ` · ${SPECIAL_WEAKNESSES[h.special].log}` : h.with_family ? ' · mamun tai lapsen kanssa' : ''}
                  </div>
                </div>
                <DeleteHitButton id={h.id} />
              </li>
            ))}
            {myKela.map((k) => (
                <li key={`kela-${k.day}`}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="who">🏥 Kela <span className="ok">{k.damage}</span></div>
                    <div className="facts">{formatDay(k.day)} · sairaspäivä</div>
                  </div>
                </li>
              ))}
          </ul>
        )}
        <Hint id="week-lock">{grace ? `Viikko ${grace} on vielä auki tänään klo 12 asti.` : `Viikon ${week} treenejä voi kirjata ma ${formatDay(lockDay).slice(3)} klo 12 asti.`} Sen jälkeen viikko lukittuu, eikä iskuja voi enää lisätä tai poistaa.</Hint>
      </section>
    </>
  );
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}
