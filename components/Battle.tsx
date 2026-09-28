import Link from 'next/link';
import { avatarUrl, monsterImageUrl } from '@/lib/supabase/client';
import type { loadBattle } from '@/lib/battle';
import { computeLedger, sealView } from '@/lib/rules';
import { finalBlows, weekRecap } from '@/lib/stats';
import { formatDay, helsinkiMs, seasonWeek, weekRange, BOSS_WEEK, MONSTER_WEEKS } from '@/lib/season';
import BossShadow from '@/components/BossShadow';
import MonsterStage, { type SealHero } from '@/components/MonsterStage';
import KillFinale from '@/components/KillFinale';
import NudgeButton from '@/components/NudgeButton';
import LiveRefresh from '@/components/LiveRefresh';
import RecapPrompt from '@/components/RecapPrompt';
import RecapCard from '@/components/RecapCard';
import QuickStep from '@/components/QuickStep';
import { stageParts, weaknessesOf } from '@/lib/trio';
import Hint from '@/components/Hint';

type BattleData = Awaited<ReturnType<typeof loadBattle>>;

const fmt = (n: number) => n.toLocaleString('fi-FI');

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h sitten`;
  return `${Math.round(h / 24)} pv sitten`;
}

type Props = { data: BattleData; userId: string; ownHit?: number | null; crit?: boolean; offsetMs?: number; isAdmin?: boolean };

export default function Battle({ data, userId, ownHit = null, crit = false, offsetMs = 0, isAdmin = false }: Props) {
  const { week, ledger, monsters, heroes, participants, required } = data;

  if (!ledger) {
    return (
      <BossShadow>
        <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>Se odottaa</h2>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Monsterien HP:ta ei ole vielä lukittu. Ylläpitäjä lukitsee tavoitteen, ja taistelu alkaa.</p>
      </BossShadow>
    );
  }

  const target = ledger.alive[0];
  // Rästit: vanhempien viikkojen elossa olevat, paitsi se, jota lyödään juuri nyt
  const backlog = ledger.alive.slice(1).filter((f) => f.week < week);
  const heroById = new Map(heroes.map((h) => [h.id, h]));
  const nameOf = (w: number) => monsters.get(w)?.name ?? (w === BOSS_WEEK ? 'Loppupomo' : `Viikon ${w} monsteri`);
  const blows = finalBlows(data);
  const kills = ledger.killed.map((k) => ({ week: k.week, name: nameOf(k.week), image: monsterImageUrl(monsters.get(k.week)?.image_path), blow: blows[k.week] ? heroById.get(blows[k.week])?.hero_name ?? 'Partio' : null }));
  const missing = target ? required.filter((id) => !target.hitters.includes(id)) : [];
  const view = target ? sealView(target, required) : null;
  const seal: SealHero[] = participants.map((id) => {
    const h = heroById.get(id);
    return { id, name: h?.hero_name ?? '', initial: (h?.hero_name ?? '?').slice(0, 1), avatar: avatarUrl(h?.avatar_path), hit: Boolean(target?.hitters.includes(id)), excused: !required.includes(id) };
  });
  const endMs = helsinkiMs(weekRange(week).end);
  const potBeforeBoss = week === BOSS_WEEK && data.ledgerInput ? Math.min(computeLedger(data.ledgerInput, MONSTER_WEEKS).pot, ledger.potCap) : 0;
  const recap = week >= 2 ? weekRecap(data, week - 1) : null;
  const potFull = ledger.pot >= ledger.potCap && ledger.potCap > 0;
  const overdue = ledger.alive.filter((f) => f.week < week).length;
  const nextReveal = week < BOSS_WEEK ? formatDay(weekRange(week + 1).start) : null;

  // Taisteluloki: viikon iskut ja partiopäivät uusimmasta alkaen; saman päivän askeleet yhtenä rivinä
  const stepDays = new Map<string, { names: string[]; at: string }>();
  for (const st of data.steps.filter((x) => seasonWeek(x.day) === week)) {
    const cur = stepDays.get(st.day) ?? { names: [], at: st.created_at };
    cur.names.push(heroById.get(st.user_id)?.hero_name ?? '?');
    if (st.created_at > cur.at) cur.at = st.created_at;
    stepDays.set(st.day, cur);
  }
  const log = [
    ...data.hits.filter((h) => seasonWeek(h.trained_on) === week).map((h) => ({ at: h.created_at, who: heroById.get(h.user_id)?.hero_name ?? '', text: `${h.sport} ${h.minutes} min${h.companions.length ? ` · ${h.companions.length + 1} hengen porukka` : ''}`, dmg: h.damage, crit: h.bonus_pct >= 100 })),
    ...[...stepDays].map(([day, v]) => ({ at: v.at, who: `👣 Askeleet ${formatDay(day)}`, text: v.names.join(', '), dmg: v.names.length * 50, crit: false })),
    ...data.patrols.filter((p) => seasonWeek(p.day) === week).map((p) => ({ at: p.at, who: '⭐ Partiopäivä', text: `Koko porukka ${formatDay(p.day)}`, dmg: 250, crit: false })),
  ].sort((a, c) => c.at.localeCompare(a.at)).slice(0, 8);

  return (
    <>
      <LiveRefresh />
      {data.hpPreview && isAdmin ? (
        <p className="note threat" style={{ margin: 0 }}>
          HP-esikatselu: tavoitetta ei ole lukittu, joten HP:t on laskettu nykyisistä lupauksista. <Link href="/yllapito">Lukitse tavoite ylläpidossa</Link> ke 30.9.
        </p>
      ) : null}
      <KillFinale killed={ledger.killed.length} kills={kills} />
      {recap ? <RecapPrompt week={recap.week}><RecapCard r={recap} /></RecapPrompt> : null}

      {target ? (
        <MonsterStage
          week={target.week}
          title={nameOf(target.week)}
          image={monsterImageUrl(monsters.get(target.week)?.image_path)}
          weakness={weaknessesOf(monsters.get(target.week)).join(', ') || null}
          parts={stageParts(monsters.get(target.week), view!.hp, false, monsterImageUrl)}
          hp={view!.hp}
          maxHp={monsters.get(target.week)?.hp ?? 1}
          padded={view!.dam}
          backlog={target.week < week}
          revealed={Boolean(monsters.get(target.week)?.name)}
          href={`/monsteri/${target.week}`}
          ownHit={ownHit}
          crit={crit}
          effects
          seal={seal}
          endMs={endMs}
          currentWeek={week}
          offsetMs={offsetMs}
          boss={target.week === BOSS_WEEK}
          potStrike={potBeforeBoss}
        />
      ) : (
        <section className="card">
          <h2 className="display">{week === BOSS_WEEK ? 'Loppupomo on kaatunut!' : 'Viikon monsteri on kaatunut!'}</h2>
          {week === BOSS_WEEK ? <p style={{ margin: 0 }}>Kausi on voitettu. Treenit kerryttävät vielä lupauksia ja tilastoja kauden loppuun.</p>
            : potFull ? <p style={{ margin: 0 }}>💰 Potti on täynnä, eli loppupomon HP puolittuu. Iskut kerryttävät silti lupauksia, tilastoja ja kunniamerkkejä.</p>
            : <p style={{ margin: 0 }}>Kaikki tämän viikon iskut menevät pottiin loppupomoa vastaan.</p>}
          {nextReveal ? <p className="muted small" style={{ margin: 0 }}>Seuraava monsteri paljastuu {nextReveal} klo 00.00.</p> : null}
        </section>
      )}

      {target && target.week < week ? (
        <section className="card threat">
          <Hint id="backlog-wait" title={<strong style={{ color: 'var(--gold)' }}>{week === BOSS_WEEK ? 'Loppupomo odottaa rästien takana.' : `${nameOf(week)} odottaa rästien takana.`}</strong>}>Iskut osuvat ensin vanhimpaan rästiin, ja vasta sen kaaduttua seuraavaan.</Hint>
          {overdue >= 2 ? <p style={{ margin: 0 }}>Rästejä on {overdue}. Vauhti ei riitä: tarvitaan yhteistreenejä ja heikkousbonuksia.</p> : null}
        </section>
      ) : null}

      {seasonWeek(data.today) >= 1 && seasonWeek(data.today) <= BOSS_WEEK ? (
        <QuickStep day={data.today} stepped={data.steps.some((s) => s.user_id === userId && s.day === data.today)} />
      ) : null}

      {target && !missing.length && required.length ? (
        <section className="card">
          <p style={{ margin: 0 }}><strong className="ok">✓ Sinetti täynnä.</strong> Kaikki terveet sankarit ovat lyöneet. {nameOf(target.week)} kaatuu heti, kun sen HP loppuu.</p>
        </section>
      ) : null}

      {target && missing.length ? (
        <section className={`card${view?.dam ? ' threat' : ''}`}>
          {view?.dam ? (
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--gold)' }}>{nameOf(target.week)} on sinettirajalla!</strong> Sille jää {fmt(view.hp)} HP (10 HP jokaista puuttuvaa kohden), ja se kaatuu heti, kun puuttuvat lyövät. Jos sinetti jää su {formatDay(weekRange(week).end).split(' ')[1]} klo 23.59 vajaaksi, monsteri jää rästiin.
            </p>
          ) : (
            <Hint id="seal" title={<strong>Sinetti {required.length - missing.length}/{required.length}</strong>}>Monsteri kaatuu vasta, kun jokainen terve sankari on lyönyt sitä treenillä. Askeleet eivät täytä sinettiä.</Hint>
          )}
          <p className="small" style={{ margin: 0 }}>Puuttuu: {missing.map((id) => heroById.get(id)?.hero_name).join(', ')}</p>
          {missing.some((id) => id !== userId) ? <NudgeButton count={missing.filter((id) => id !== userId).length} /> : null}
        </section>
      ) : null}

      <div className="stat-row">
        <Link href="/bestiaario" className="stat rowlink"><span className="muted small">Kaatuneet</span><strong>{ledger.killed.filter((k) => k.week <= MONSTER_WEEKS).length}/{MONSTER_WEEKS}</strong></Link>
        <div className="stat"><span className="muted small">Potti loppupomolle</span><strong>{potFull ? `💰 ${fmt(ledger.potCap)}` : fmt(ledger.pot)}</strong><span className="muted small">{potFull ? 'täynnä' : `katto ${fmt(ledger.potCap)}`}</span></div>
      </div>

      {backlog.length ? (
        <section className="card">
          <Hint id="backlog" className="muted small" title={<h2 className="display">Rästit</h2>}>Vanhin rästi ottaa iskut ensin, ja sen jälkeen ylijäämä siirtyy seuraavaan.</Hint>
          {backlog.map((f) => <p key={f.week} style={{ margin: 0 }}>{nameOf(f.week)}: {(() => { const v = sealView(f, required); return v.dam ? `${fmt(v.hp)} HP, sinettirajalla` : `${fmt(v.hp)} HP`; })()}</p>)}
        </section>
      ) : null}

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display">Taisteluloki</h2>
          <span className="muted small">päivittyy livenä</span>
        </div>
        {log.length ? (
          <ul className="log">
            {log.map((e, i) => (
              <li key={i}>
                <div style={{ minWidth: 0 }}>
                  <div><strong>{e.who}</strong>{e.crit ? <span className="tag">KRIITTINEN</span> : null}</div>
                  <div className="when">{e.text} · {ago(e.at)}</div>
                </div>
                <span className={`dmg${e.crit ? ' crit' : ''}`}>−{fmt(e.dmg)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Ei vielä iskuja tällä viikolla. Ole ensimmäinen!</p>}
        {recap ? <Link href={`/raportti/${recap.week}`} className="muted small">Viikon {recap.week} raportti →</Link> : null}
      </section>
    </>
  );
}
