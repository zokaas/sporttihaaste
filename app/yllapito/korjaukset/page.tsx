import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SPORTS } from '@/lib/rules';
import { SEASON_START, formatDay, seasonWeek, weekRange } from '@/lib/season';
import { today } from '@/lib/today';
import { AdminHitForm, AdminSickForm, DeleteRow } from '@/components/AdminTools';

export const dynamic = 'force-dynamic';

const TABLES = [
  { key: 'hits', label: 'Iskut' },
  { key: 'step_days', label: 'Askeleet' },
  { key: 'sick_periods', label: 'Sairaudet' },
  { key: 'pledge_changes', label: 'Lupausmuutokset' },
  { key: 'profiles', label: 'Sankarit' },
  { key: 'monsters', label: 'Monsterit' },
];

export default async function Korjaukset({ searchParams }: { searchParams: { vko?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) redirect('/');

  const now = today();
  const current = Math.min(11, Math.max(1, seasonWeek(now)));
  const week = Math.min(11, Math.max(1, Number(searchParams.vko) || current));
  const { start, end } = weekRange(week);
  const [{ data: heroes }, { data: hits }, { data: sick }] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, pledge_locked_at').order('hero_name'),
    supabase.from('hits').select('*').gte('trained_on', start).lte('trained_on', end).order('trained_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('sick_periods').select('*').order('starts_on', { ascending: false }),
  ]);
  const heroList = (heroes ?? []).filter((h) => h.pledge_locked_at).map((h) => ({ id: h.id, name: h.hero_name ?? '' }));
  const name = (id: string) => heroList.find((h) => h.id === id)?.name ?? '?';
  const maxDay = now < SEASON_START ? SEASON_START : now;

  return (
    <>
      <Link href="/yllapito" className="muted">← Ylläpito</Link>
      <h1 className="display">Korjaukset</h1>

      <section className="card">
        <h2 className="display">Iskut viikolla {week}</h2>
        <div className="chips">
          {Array.from({ length: current }, (_, i) => i + 1).map((w) => (
            <Link key={w} href={`/yllapito/korjaukset?vko=${w}`} className="chip" aria-pressed={w === week}>{w}</Link>
          ))}
        </div>
        {(hits ?? []).length ? (
          <ul className="people">
            {(hits ?? []).map((h) => (
              <li key={h.id}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{name(h.user_id)} · {h.damage}</div>
                  <div className="facts">{formatDay(h.trained_on)} · {h.sport} {h.minutes} min{h.bonus_pct ? ` · +${h.bonus_pct} %` : ''}{h.companions.length ? ` · ${h.companions.length + 1} hlö` : ''}</div>
                </div>
                <DeleteRow id={h.id} kind="hit" />
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Ei iskuja.</p>}
      </section>

      <section className="card">
        <h2 className="display">Kirjaa sankarin puolesta</h2>
        <p className="muted small" style={{ margin: 0 }}>Mille tahansa kauden päivälle, myös lukitulle viikolle. Vahinko ja bonukset lasketaan säännöistä.</p>
        <AdminHitForm heroes={heroList} sports={SPORTS.map((s) => s.name)} min={SEASON_START} max={maxDay} />
      </section>

      <section className="card">
        <h2 className="display">Sairaudet</h2>
        <AdminSickForm heroes={heroList} min={SEASON_START} max={maxDay} />
        {(sick ?? []).length ? (
          <ul className="people">
            {(sick ?? []).map((p) => (
              <li key={p.id}>
                <div className="grow">
                  <div className="who">{name(p.user_id)}</div>
                  <div className="facts">{formatDay(p.starts_on)} – {p.ends_on ? formatDay(p.ends_on) : 'jatkuu'}</div>
                </div>
                <DeleteRow id={p.id} kind="sick" />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2 className="display">Varmuuskopio</h2>
        <p className="muted small" style={{ margin: 0 }}>Lataa taulut CSV-tiedostoina (aukeavat Excelissä). Ota kopio esimerkiksi joka maanantai.</p>
        <div className="chips">
          {TABLES.map((t) => <a key={t.key} className="chip" href={`/api/vienti?taulu=${t.key}`} download>{t.label}</a>)}
        </div>
      </section>
    </>
  );
}
