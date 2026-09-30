import MonsterStage from '@/components/MonsterStage';
import KillFinale from '@/components/KillFinale';
import LiveRefresh from '@/components/LiveRefresh';
import { monsterImageUrl } from '@/lib/supabase/client';
import { helsinkiMs, GATE_DAY, formatDay } from '@/lib/season';
import { STEP_DAY_DAMAGE } from '@/lib/rules';
import { hitReaction } from '@/lib/taunts';
import type { Gate } from '@/lib/gate';

const fmt = (n: number) => n.toLocaleString('fi-FI');

type Props = {
  gate: Gate;
  hits: { user_id: string; damage: number; sport: string; minutes: number; trained_on: string; created_at: string }[];
  /** Porttipäivien askelkuittaukset. */
  steps: { user_id: string; day: string; created_at: string }[];
  names: Map<string, string>;
  stepped: number;
  ownHit: number | null;
  crit: boolean;
  offsetMs: number;
};

/** Portinvartija ti 29.9.–ke 30.9.: taistelu ennen kauden alkua. Ei sinettiä, kaatuu kun HP loppuu. */
export default function GateBattle({ gate, hits, steps, names, stepped, ownHit, crit, offsetMs }: Props) {
  // Iskut ja askelkuittaukset samassa listassa (jokainen omana rivinään); uusimmat 6, loput näkyvät yhteismäärässä.
  const all = [
    ...hits.map((h) => ({ at: h.created_at, who: names.get(h.user_id) || 'Sankari', dmg: h.damage, facts: `${h.sport} ${h.minutes} min · ${formatDay(h.trained_on)}` })),
    ...steps.map((st) => ({ at: st.created_at, who: names.get(st.user_id) || 'Sankari', dmg: STEP_DAY_DAMAGE, facts: `👣 Askeleet · ${formatDay(st.day)}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const recent = all.slice(0, 6);
  const fmtS = gate.surplus ? ` Ylijäämä ${fmt(gate.surplus)} voimaa menee pottiin loppupomoa vastaan.` : '';
  return (
    <>
      <LiveRefresh />
      <KillFinale
        killed={gate.killed ? 1 : 0}
        kills={[{ week: 0, name: gate.name, image: monsterImageUrl(gate.image_path), blow: null }]}
        storageKey="mj_gate_killed"
        showFirst
        label="Portti on auki"
        note={`Portinvartija kaatui ennen kauden alkua.${fmtS} Torstaina klo 00.00 ensimmäinen monsteri astuu esiin.`}
      />
      <MonsterStage
        week={0}
        label="⚠️ Ennen aikojaan"
        revealLabel="Etuajassa"
        revealLine="Se ei odottanut torstaihin."
        title={gate.name}
        image={monsterImageUrl(gate.image_path)}
        weakness={null}
        hp={gate.left}
        maxHp={gate.hp}
        padded={0}
        backlog={false}
        // Kaatuneelle ei näytetä paljastusanimaatiota (kaatumisruutu näytetään sen sijaan).
        revealed={!gate.killed}
        dead={gate.killed}
        ownHit={ownHit}
        crit={crit}
        effects
        endMs={helsinkiMs(GATE_DAY, '23:59:59')}
        offsetMs={offsetMs}
        taunt={gate.taunt ?? 'Näen teidät. Portti ei aukea kenellekään.'}
        hitLine={ownHit != null ? hitReaction(null, null, crit) : null}
      />
      {gate.description ? <p className="narrator">{gate.description}</p> : null}
      <section className={`card${gate.killed ? '' : ' threat'}`}>
        {gate.killed ? (
          <>
            <h2 className="display">Portti on auki!</h2>
            <p style={{ margin: 0 }}>{gate.name} kaatui. {gate.surplus ? `Ylijäämä ${fmt(gate.surplus)} voimaa menee pottiin loppupomoa vastaan.` : ''} Torstaina klo 00.00 ensimmäinen monsteri astuu esiin.</p>
          </>
        ) : (
          <>
            <h2 className="display">Portti aukesi etuajassa</h2>
            <p style={{ margin: 0 }}>Kauden piti alkaa torstaina, mutta pimeys ei odottanut. {gate.name} vartioi porttia, ja se on kaadettava ennen ke 30.9. klo 23.59. Treenit ja askeleet lyövät, eikä sinettiä tarvita. Jos se jää henkiin, jäljelle jäänyt HP siirtyy torstain monsterille.</p>
            <p className="muted small" style={{ margin: 0 }}>Ti–ke treenit eivät kerry viikon 1 lupaukseen.</p>
          </>
        )}
        <p className="small" style={{ margin: 0 }}>Askeleet tänään: {stepped} · iskuja yhteensä: {hits.length}</p>
      </section>
      {recent.length ? (
        <section className="card">
          <h2 className="display">Iskut portille{all.length > recent.length ? <span className="muted small"> · uusimmat {recent.length}/{all.length}</span> : null}</h2>
          <ul className="people">
            {recent.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{h.who} <span className="ok">{fmt(h.dmg)}</span></div>
                  <div className="facts">{h.facts}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
