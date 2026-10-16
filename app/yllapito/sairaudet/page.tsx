import Link from 'next/link';
import { redirect } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { createClient } from '@/lib/supabase/server';
import { loadBattle } from '@/lib/battle';
import { SEASON_START, addDays, formatDay, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';
import { today } from '@/lib/today';
import { isSickOn, kelaDayDamage } from '@/lib/weekly';
import { AdminSickForm, DeleteRow, EndSickButton, SickCell } from '@/components/AdminTools';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

/** Ylläpito: kuka on kipeänä, viikkoruudukko sairaspäivistä (napauttamalla muokattava) ja kaikki jaksot. */
export default async function Sairaudet({ searchParams }: { searchParams: { vko?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) redirect('/');

  const now = today();
  const b = await loadBattle(supabase, now);
  const current = Math.min(BOSS_WEEK, Math.max(1, seasonWeek(now)));
  const week = Math.min(current, Math.max(1, Number(searchParams.vko) || current));
  const { start, end } = weekRange(week);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const { data: periodRows } = await supabase.from('sick_periods').select('id, user_id, starts_on, ends_on').order('starts_on', { ascending: false });
  const periods = periodRows ?? [];
  const heroes = b.participants.map((id) => ({ id, name: b.heroes.find((x) => x.id === id)?.hero_name ?? '?' }));
  const name = (id: string) => heroes.find((x) => x.id === id)?.name ?? '?';
  const ongoing = periods.filter((p) => p.starts_on <= now && (p.ends_on === null || p.ends_on >= now));
  const kelaOf = (userId: string, from: string, to: string) => b.kela.filter((k) => k.userId === userId && k.day >= from && k.day <= to).reduce((a, k) => a + k.damage, 0);
  const maxDay = now < SEASON_START ? SEASON_START : now;

  return (
    <>
      <BackButton fallback="/yllapito" label="Ylläpito" />
      <h1 className="display">Sairaudet</h1>

      <section className="card">
        <h2 className="display">🤒 Kipeänä nyt</h2>
        {ongoing.length ? (
          <ul className="people">
            {ongoing.map((p) => (
              <li key={p.id}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{name(p.user_id)}</div>
                  <div className="facts">
                    {formatDay(p.starts_on)} alkaen · {daysBetween(p.starts_on, now)}. päivä · {p.ends_on ? `viimeinen päivä ${formatDay(p.ends_on)}` : 'jatkuu'}
                    {' · '}Kela {fmt(kelaDayDamage(b.pledgeOf(p.user_id, current)))}/pv
                  </div>
                </div>
                {p.ends_on === null ? <EndSickButton id={p.id} name={name(p.user_id)} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Kaikki ovat terveinä.</p>}
      </section>

      <section className="card">
        <h2 className="display">Viikko {week}</h2>
        <div className="chips">
          {Array.from({ length: current }, (_, i) => i + 1).map((w) => (
            <Link key={w} href={`/yllapito/sairaudet?vko=${w}`} className="chip" aria-pressed={w === week}>{w}</Link>
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>Napauta päivää merkitäksesi sen sairaaksi tai terveeksi. Sairaaksi merkityn päivän treenit ja askeleet poistuvat.</p>
        <div className="sick-grid-wrap">
          <table className="sick-grid">
            <thead>
              <tr>
                <th scope="col">Sankari</th>
                {days.map((d) => <th key={d} scope="col">{formatDay(d).split(' ')[0]}<br /><span className="muted">{+d.slice(8, 10)}.</span></th>)}
              </tr>
            </thead>
            <tbody>
              {heroes.map((x) => {
                const st = b.pledgeStatus(x.id, week);
                const kela = kelaOf(x.id, start, end);
                return (
                  <tr key={x.id}>
                    <th scope="row">
                      <span className="sick-name">{x.name}</span>
                      <span className="muted small">
                        {st.excused ? '🤒 vapautettu' : st.sickDays ? `lupaus ${h(st.target)}` : ''}{kela ? ` · Kela ${fmt(kela)}` : ''}
                      </span>
                    </th>
                    {days.map((d) => (
                      <td key={d}>
                        <SickCell userId={x.id} day={d} sick={isSickOn(b.periods, x.id, d)} disabled={d > now || d < SEASON_START} label={`${x.name} ${formatDay(d)}`} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="display">Merkitse jakso</h2>
        <p className="muted small" style={{ margin: 0 }}>Pidemmälle tai jatkuvalle sairaudelle.</p>
        <AdminSickForm heroes={heroes} min={SEASON_START} max={maxDay} />
      </section>

      <section className="card">
        <h2 className="display">Kaikki jaksot</h2>
        {periods.length ? (
          <ul className="people">
            {periods.map((p) => {
              const last = p.ends_on ?? now;
              const len = last >= p.starts_on ? daysBetween(p.starts_on, last) : 0;
              return (
                <li key={p.id}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="who">{name(p.user_id)}</div>
                    <div className="facts">
                      {formatDay(p.starts_on)} – {p.ends_on ? formatDay(p.ends_on) : 'jatkuu'} · {len} pv · Kela {fmt(kelaOf(p.user_id, p.starts_on, last))}
                    </div>
                  </div>
                  <DeleteRow id={p.id} kind="sick" />
                </li>
              );
            })}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Ei sairausjaksoja.</p>}
      </section>
    </>
  );
}
