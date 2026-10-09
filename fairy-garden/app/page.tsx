import Link from 'next/link';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { SPORTS, helsinkiDay, points, stageFor } from '@/lib/garden';
import { join, leave, logSteps, logWorkout } from './actions';
import Countdown from '@/components/Countdown';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { virhe?: string } }) {
  const token = cookies().get('fg_token')?.value;
  const supabase = db();
  const [{ data: fairies }, { data: steps }, { data: workouts }] = await Promise.all([
    supabase.from('fairies').select('id, name, token'),
    supabase.from('steps').select('fairy_id, day, steps'),
    supabase.from('workouts').select('fairy_id, minutes'),
  ]);

  const board = (fairies ?? [])
    .map((f) => {
      const st = (steps ?? []).filter((s) => s.fairy_id === f.id);
      const totalSteps = st.reduce((a, s) => a + s.steps, 0);
      const mins = (workouts ?? []).filter((w) => w.fairy_id === f.id).reduce((a, w) => a + w.minutes, 0);
      const today = st.find((s) => s.day === helsinkiDay())?.steps ?? 0;
      return { id: f.id, name: f.name, mine: f.token === token, totalSteps, mins, today, pts: points(totalSteps, mins) };
    })
    .sort((a, b) => b.pts - a.pts);
  const me = board.find((b) => b.mine);

  return (
    <>
      <h1>🌸 Fairy Garden 🧚🏼‍♀️</h1>
      <p className="sub">Kävele kukkaan, kasva keijuksi</p>
      <Countdown />

      {!me ? (
        <form action={join} className="card">
          <h2>Liity puutarhaan ✨</h2>
          <input name="name" placeholder="Keijun nimi" maxLength={30} required />
          {searchParams.virhe && <p className="err">Jokin meni pieleen, yritä uudelleen.</p>}
          <button className="btn">Istuta siemen 🌰</button>
        </form>
      ) : (
        <>
          <section className="card hero">
            {(() => {
              const { stage, next, pct } = stageFor(me.pts);
              return (
                <>
                  <div className="big">{stage.emoji}</div>
                  <h2>{me.name} · {stage.name}</h2>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <p className="muted">
                    {me.pts} pistettä · {me.totalSteps.toLocaleString('fi-FI')} askelta · tänään {me.today.toLocaleString('fi-FI')}
                    {next && <> · seuraavaksi {next.emoji} {next.name}</>}
                  </p>
                </>
              );
            })()}
          </section>

          <section className="card">
            <h2>Kirjaa askeleet käsin</h2>
            <form action={logSteps}>
              <div className="row">
                <input name="steps" type="number" inputMode="numeric" min={0} max={200000} placeholder="Askelia" required />
                <input name="day" type="date" defaultValue={helsinkiDay()} />
              </div>
              <button className="btn ghost">Tallenna</button>
            </form>
            <p className="muted">Automaattinen synkronointi: <Link href="/shortcut">Oikotie-ohje</Link></p>
          </section>

          <section className="card">
            <h2>Kirjaa liikunta 💪</h2>
            <form action={logWorkout}>
              <div className="row">
                <select name="sport">{SPORTS.map((s) => <option key={s}>{s}</option>)}</select>
                <input name="minutes" type="number" inputMode="numeric" min={1} max={600} placeholder="Minuuttia" required />
              </div>
              <button className="btn ghost">Lisää</button>
            </form>
          </section>
        </>
      )}

      <section className="card">
        <h2>Puutarhan kärki 🏆</h2>
        {board.length === 0 ? <p className="muted">Ei vielä keijuja.</p> : (
          <ol className="rank">
            {board.map((b, i) => (
              <li key={b.id} className={b.mine ? 'me' : ''}>
                <span className="pos">{i + 1}</span>
                <span className="nm">{stageFor(b.pts).stage.emoji} {b.name}</span>
                <span className="pt">{b.pts} p</span>
              </li>
            ))}
          </ol>
        )}
        <p className="muted">1 piste / 1 000 askelta ja 1 piste / 10 min liikuntaa.</p>
      </section>

      {me && <form action={leave}><button className="btn ghost">Poistu tältä laitteelta</button></form>}
    </>
  );
}
