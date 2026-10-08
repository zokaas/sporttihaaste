import Link from 'next/link';
import { avatarUrl, hitPhotoUrl, monsterImageUrl, resizedImage } from '@/lib/supabase/client';
import { ZoomImg } from '@/components/ImageViewer';
import type { loadBattle } from '@/lib/battle';
import { computeLedger, hitBonusText, potParts, sealView, STEP_DAY_DAMAGE } from '@/lib/rules';
import { finalBlows, weekRecap } from '@/lib/stats';
import { addDays, formatDay, helsinkiMs, KELA_TIME, seasonWeek, weekRange, BOSS_WEEK, MONSTER_WEEKS, SEASON_START } from '@/lib/season';
import BossShadow from '@/components/BossShadow';
import { bossWhisper } from '@/lib/boss';
import { lineText, stageHitLine, stageTaunt } from '@/lib/taunts';
import MonsterStage, { type SealHero } from '@/components/MonsterStage';
import KillFinale from '@/components/KillFinale';
import NudgeButton from '@/components/NudgeButton';
import LiveRefresh from '@/components/LiveRefresh';
import AwaySummary, { type AwayEvent } from '@/components/AwaySummary';
import RecapPrompt from '@/components/RecapPrompt';
import RecapCard from '@/components/RecapCard';
import { activeWeaknesses, stageParts } from '@/lib/trio';
import Hint from '@/components/Hint';
import TodayCard from '@/components/TodayCard';
import { isSickOn } from '@/lib/weekly';
import { MID_CARD_UNTIL, midseasonReady } from '@/lib/midseason';

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
  const kills = ledger.killed.map((k) => ({ week: k.week, name: nameOf(k.week), image: monsterImageUrl(monsters.get(k.week)?.image_path), images: (monsters.get(k.week)?.parts ?? []).map((x) => monsterImageUrl(x.image_path)).filter((x): x is string => Boolean(x)), blow: blows[k.week] ? heroById.get(blows[k.week])?.hero_name ?? 'Megamarssi' : null, killedAt: k.killedAt }));
  const missing = target ? required.filter((id) => !target.hitters.includes(id)) : [];
  const view = target ? sealView(target, required) : null;
  // Monsterin repliikki HP:n mukaan: ylläpidon kirjoittama tai oletus.
  const targetMonster = target ? monsters.get(target.week) : undefined;
  // Kaksikolla ja kolmikolla elossa olevat osat puhuvat omat repliikkinsä.
  const taunt = view ? stageTaunt(targetMonster, view.hp, target.week < week) : null;
  // Sinetti tulee näkyviin vasta viikon perjantaina: alkuviikon näkymä on kevyt. Sääntö on silti voimassa
  // koko viikon; padon kortti näytetään aina, koska silloin voimaa on vaakalaudalla.
  const showSeal = data.today >= addDays(weekRange(week).end, -2);
  const seal: SealHero[] = participants.map((id) => {
    const h = heroById.get(id);
    return { id, name: h?.hero_name ?? '', initial: (h?.hero_name ?? '?').slice(0, 1), avatar: avatarUrl(h?.avatar_path), hit: Boolean(target?.hitters.includes(id)), excused: !required.includes(id) };
  });
  // Lähtölaskenta päättyy, kun uusi monsteri paljastuu (su klo 24). Kirjaukset ovat auki ma klo 12 asti.
  const endMs = helsinkiMs(weekRange(week).end);
  // Poissaolon kooste: tämän viikon muiden iskut ja askeleet aikaleimoineen (selain valitsee edellisen käynnin jälkeiset).
  const awayEvents: AwayEvent[] = [
    ...data.hits.filter((h) => h.user_id !== userId && seasonWeek(h.trained_on) === week).map((h) => ({ at: h.created_at, name: heroById.get(h.user_id)?.hero_name ?? 'Sankari', kind: 'hit' as const, damage: h.damage })),
    ...data.steps.filter((s) => s.user_id !== userId && seasonWeek(s.day) === week).map((s) => ({ at: s.created_at, name: heroById.get(s.user_id)?.hero_name ?? 'Sankari', kind: 'step' as const, damage: STEP_DAY_DAMAGE })),
  ];
  const potBeforeBoss = week === BOSS_WEEK && data.ledgerInput ? computeLedger(data.ledgerInput, MONSTER_WEEKS).pot : 0;
  // Mistä ensi-isku on kertynyt (pidetyt lupaukset vain päättyneiltä viikoilta).
  const potShown = week === BOSS_WEEK ? potBeforeBoss : ledger?.pot ?? 0;
  const potFrom = data.ledgerInput
    ? potParts(potShown, data.ledgerInput.startPot ?? 0, Object.entries(data.ledgerInput.pledgeBonusesByWeek).filter(([w]) => Number(w) <= MONSTER_WEEKS).reduce((a, [, n]) => a + n, 0))
    : [];
  // Viikkoraportti näytetään vasta, kun armonaika on ohi (ma klo 12), jolloin luvut ovat lopullisia.
  const recap = week >= 2 && !data.grace ? weekRecap(data, week - 1) : null;
  const lastDay = week >= 1 && week <= BOSS_WEEK && data.today === weekRange(week).end;
  const overdue = ledger.alive.filter((f) => f.week < week).length;
  // Ennakkoarvoitus: perjantaista alkaen varjo ja vihje seuraavasta monsterista.
  const teaser = week < BOSS_WEEK && data.today >= addDays(weekRange(week).end, -2)
    ? monsters.get(week + 1)?.teaser || (week + 1 === BOSS_WEEK ? 'Maa tärisee. Jokin valtava heräilee unestaan…' : 'Jotain liikkuu varjoissa. Se tietää jo nimesi…')
    : null;
  // Tulevan viikon heikkoudet vihjeeseen (kaksikolla ja kolmikolla kaikkien osien heikkoudet).
  const next = teaser ? monsters.get(week + 1) : undefined;
  const nextWeak = next?.teaser_weaknesses ?? [];

  // Taisteluloki: viikon iskut, askelkuittaukset (jokainen omana rivinään) ja megamarssit uusimmasta alkaen.
  // Kirjaaja ja seuralaiset nimeltä: "Joar + Markiisitar", isommasta porukasta kolme nimeä ja loput lukuna.
  const heroName = (id: string) => heroById.get(id)?.hero_name ?? '?';
  const withCompanions = (userId: string, companions: string[]) => {
    const names = companions.map(heroName);
    const shown = names.length > 3 ? `${names.slice(0, 3).join(', ')} + ${names.length - 3} muuta` : names.join(', ');
    return `${heroName(userId)}${shown ? ` + ${shown}` : ''}`;
  };
  // Jokainen rivi samassa muodossa: toiminto otsikkona, tekijä ja päivä alla.
  const log = [
    ...data.hits.filter((h) => seasonWeek(h.trained_on) === week).map((h) => ({ at: h.created_at, icon: '⚔️', title: `${h.sport} ${h.minutes} min`, by: withCompanions(h.user_id, h.companions), day: h.trained_on, dmg: h.damage, crit: h.bonus_pct >= 100, bonus: hitBonusText(h), photo: hitPhotoUrl(h.photo_path) })),
    ...data.steps.filter((st) => seasonWeek(st.day) === week).map((st) => ({ at: st.created_at, icon: '👣', title: 'Askeleet', by: heroById.get(st.user_id)?.hero_name ?? '?', day: st.day, dmg: STEP_DAY_DAMAGE, crit: false, bonus: '', photo: null })),
    ...data.patrols.filter((p) => seasonWeek(p.day) === week).map((p) => ({ at: p.at, icon: '⭐', title: 'Megamarssi', by: 'Koko porukka', day: p.day, dmg: 250, crit: false, bonus: '', photo: null })),
    ...data.kela.filter((k) => seasonWeek(k.day) === week).map((k) => ({ at: new Date(helsinkiMs(k.day, KELA_TIME)).toISOString(), icon: '🏥', title: 'Kela', by: heroName(k.userId), day: k.day, dmg: k.damage, crit: false, bonus: '', photo: null })),
  ].sort((a, c) => c.at.localeCompare(a.at)).slice(0, 6);

  return (
    <>
      <LiveRefresh />
      {data.hpPreview && isAdmin ? (
        <p className="note threat" style={{ margin: 0 }}>
          HP-esikatselu: tavoitetta ei ole lukittu, joten HP:t on laskettu nykyisistä lupauksista. <Link href="/yllapito">Lukitse tavoite ylläpidossa</Link> ke 30.9.
        </p>
      ) : null}
      <KillFinale killed={ledger.killed.length} kills={kills} recapEndMs={recap ? helsinkiMs(weekRange(recap.week).end) : undefined} />
      {data.grace ? (
        <p className="note threat" style={{ margin: 0 }}>
          ⏳ <strong>Viikko {data.grace} on vielä auki tänään klo 12 asti.</strong> Kirjaa puuttuvat treenit ja askeleet, niin ne lasketaan viikon {data.grace} monsteriin ja lupaukseen. <Link href="/kirjaa">Kirjaa →</Link>
        </p>
      ) : lastDay ? (
        <p className="note" style={{ margin: 0 }}>
          ⏳ <strong>Viikko {week} päättyy tänään.</strong> Kirjaa viikon treenit viimeistään ma klo 12, jolloin viikko lukittuu. <Link href="/kirjaa">Kirjaa →</Link>
        </p>
      ) : week === BOSS_WEEK && target?.week === BOSS_WEEK && data.today >= addDays(weekRange(week).end, -2) ? (
        // Loppupomon viikon viimeinen viikonloppu (pe–la); sunnuntaina näkyy "päättyy tänään".
        <p className="note threat" style={{ margin: 0 }}>
          🔥 <strong>Viimeinen viikonloppu.</strong> Loppupomolla on {fmt(view!.hp)} HP jäljellä, ja kausi päättyy su klo 24. Jokainen treeni ja askelpäivä ratkaisee. <Link href="/kirjaa">Kirjaa →</Link>
        </p>
      ) : null}
      {midseasonReady(data) && data.today <= MID_CARD_UNTIL ? (
        <Link href="/raportti/puolivali" className="note" style={{ margin: 0, display: 'block', textDecoration: 'none' }}>
          📊 <strong>Kausi puolivälissä.</strong> Katso porukan välitilanne ja jaa se WhatsAppiin →
        </Link>
      ) : null}
      {data.today === SEASON_START && (data.gate.dealt > 0 || data.gate.left > 0) ? (
        // Portinvartijan (29.–30.9.) tulos kauden ensimmäisenä päivänä: selittää viikon 1 monsterin lisä-HP:n tai potin ylijäämän.
        <section className={`card gate-result${data.gate.killed ? '' : ' threat'}`}>
          <p style={{ margin: 0 }}>
            {data.gate.killed
              ? <>👁️ <strong>{data.gate.name} kaatui portilla.</strong> {data.gate.surplus ? `Ylijäämä ${fmt(data.gate.surplus)} voimaa on potissa loppupomoa vastaan.` : 'Portti aukesi täsmälleen.'}</>
              : <>👁️ <strong>{data.gate.name} selvisi.</strong> Sen jäljelle jäänyt {fmt(data.gate.left)} HP siirtyi viikon 1 monsterille: {nameOf(1)}.</>}
          </p>
        </section>
      ) : null}
      {target ? <AwaySummary events={awayEvents} skip={ownHit != null} strike={{ name: nameOf(target.week), image: monsterImageUrl(targetMonster?.image_path), hp: view!.hp, maxHp: targetMonster?.hp ?? 1, reaction: lineText(stageHitLine(targetMonster, view!.hp, false)) }} /> : null}
      {recap ? <RecapPrompt week={recap.week}><RecapCard r={recap} /></RecapPrompt> : null}

      {target ? (
        <MonsterStage
          week={target.week}
          title={nameOf(target.week)}
          image={monsterImageUrl(monsters.get(target.week)?.image_path)}
          weakness={activeWeaknesses(monsters.get(target.week), view!.hp).join(', ') || null}
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
          seal={showSeal ? seal : undefined}
          endMs={endMs}
          currentWeek={week}
          taunt={taunt}
          hitLine={ownHit != null ? stageHitLine(targetMonster, view!.hp, crit, ownHit) : null}
          offsetMs={offsetMs}
          boss={target.week === BOSS_WEEK}
          potStrike={potBeforeBoss}
        />
      ) : (
        <section className="card">
          <h2 className="display">{week === BOSS_WEEK ? 'Loppupomo on kaatunut!' : 'Viikon monsteri on kaatunut!'}</h2>
          {week === BOSS_WEEK ? <p style={{ margin: 0 }}>Kausi on voitettu. Treenit kerryttävät vielä lupauksia ja tilastoja kauden loppuun.</p>
            : <p style={{ margin: 0 }}>Kaikki tämän viikon iskut säästyvät ensi-iskuun loppupomoa vastaan.</p>}
          {week < BOSS_WEEK ? (
            <blockquote className="boss-whisper">
              <span className="boss-whisper-eyes" aria-hidden="true" />
              <p>”{bossWhisper(week, monsters.get(week)?.boss_whisper)}”</p>
              <cite>Jokin varjoissa</cite>
            </blockquote>
          ) : null}
        </section>
      )}

      {teaser ? (
        <section className="card teaser">
          <svg className="teaser-shadow" viewBox="0 0 390 300" aria-hidden="true">
            <path d="M70 300 C80 215 125 170 158 156 C140 120 126 76 104 30 C146 60 166 100 176 138 C186 134 204 134 214 138 C224 100 244 60 286 30 C264 76 250 120 232 156 C265 170 310 215 320 300 Z" fill="#050303" />
            <ellipse cx="180" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
            <ellipse cx="210" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <span className="stage-week">{week + 1 === BOSS_WEEK ? 'Loppupomo' : 'Seuraava monsteri'}</span>
            <p className="teaser-text">“{teaser}”</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {next?.hp ? <span className="pill">Voima: {fmt(next.hp)} HP</span> : null}
              {nextWeak.length ? <span className="pill">{nextWeak.length > 1 ? 'Heikkoudet' : 'Heikkous'}: {nextWeak.join(', ')}</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      {showSeal && target && !missing.length && required.length ? (
        <section className="card">
          <p style={{ margin: 0 }}><strong className="ok">✓ Sinetti täynnä.</strong> Kaikki terveet sankarit ovat lyöneet. {nameOf(target.week)} kaatuu heti, kun sen HP loppuu.</p>
        </section>
      ) : null}

      {target && missing.length && (showSeal || view?.dam) ? (
        <section className={`card${view?.dam ? ' threat' : ''}`}>
          {view?.dam ? (
            <>
              <div className="dam-lock">
                <span className="dam-lock-icon" aria-hidden="true">🔒</span>
                <div>
                  <strong className="dam-lock-amount">{fmt(view.dam)} voimaa odottaa sinettiä</strong>
                  <span className="muted small">{nameOf(target.week)} on sinettirajalla ({fmt(view.hp)} HP).</span>
                </div>
              </div>
              <p style={{ margin: 0 }}>
                Kun {missing.map((id) => heroById.get(id)?.hero_name).join(', ').replace(/, ([^,]*)$/, ' ja $1')} {missing.length > 1 ? 'lyövät' : 'lyö'}, monsteri kaatuu heti ja koko pato siirtyy eteenpäin. Jos sinetti on vielä vajaa, kun viikko lukittuu ma {formatDay(addDays(weekRange(week).end, 1)).split(' ')[1]} klo 12, pato menetetään ja monsteri jää rästiin.
              </p>
            </>
          ) : null}
          {view?.dam ? (
            <>
              <p className="small" style={{ margin: 0 }}>Puuttuu: {missing.map((id) => heroById.get(id)?.hero_name).join(', ')}</p>
              {missing.some((id) => id !== userId) ? <NudgeButton count={missing.filter((id) => id !== userId).length} /> : null}
            </>
          ) : (
            // Ilman patoa sinetti on yksi rivi: nimet näkyvät jo näyttämön sinettirivillä, joten tässä vain määrä.
            <div className="row seal-line">
              <p className="grow small" title={`Puuttuu: ${missing.map((id) => heroById.get(id)?.hero_name).join(', ')}`}>
                <strong>Sinetti {required.length - missing.length}/{required.length}</strong> · {missing.includes(userId) ? (missing.length === 1 ? 'vain sinä puutut' : `puuttuu ${missing.length}, myös sinä`) : `puuttuu ${missing.length}`}
              </p>
              {missing.some((id) => id !== userId) ? <NudgeButton compact count={missing.filter((id) => id !== userId).length} /> : null}
            </div>
          )}
        </section>
      ) : null}

      {/* Askelet kuitataan alapalkin Lyö-valikosta; tässä vain muistutus sairauspäivästä. */}
      {seasonWeek(data.today) >= 1 && seasonWeek(data.today) <= BOSS_WEEK && isSickOn(data.periods, userId, data.today)
        ? <p className="note" style={{ margin: 0 }}>🤒 Olet merkinnyt itsesi kipeäksi tänään, joten askelia ei tarvita. Parane pian!</p>
        : null}

      <TodayCard b={data} showNextReveal={!teaser} />

      {backlog.length || (target && target.week < week) ? (
        <section className={`card${target && target.week < week ? ' threat' : ''}`}>
          <Hint id="backlog" title={<h2 className="display">Rästit</h2>}>Vanhin rästi ottaa iskut ensin, ja vasta sen kaaduttua voima siirtyy seuraavaan.{target && target.week < week ? ` ${week === BOSS_WEEK ? 'Loppupomo' : nameOf(week)} odottaa rästien takana.` : ''}</Hint>
          {ledger.alive.filter((f) => f.week < week).map((f) => <p key={f.week} style={{ margin: 0 }}>{nameOf(f.week)}: {(() => { const v = sealView(f, required); return v.dam ? `${fmt(v.hp)} HP, sinettirajalla` : `${fmt(v.hp)} HP`; })()}</p>)}
          {overdue >= 2 ? <p style={{ margin: 0, color: 'var(--gold)' }}>Rästejä on {overdue}. Vauhti ei riitä: tarvitaan yhteistreenejä ja heikkousbonuksia.</p> : null}
        </section>
      ) : null}

      <div className="stat-row" style={{ gridTemplateColumns: '1fr' }}>
        <div className="stat"><span className="muted small">Ensi-isku loppupomolle</span><strong>{fmt(potShown)} ⚔️</strong><span className="muted small">{week === BOSS_WEEK ? 'Osui loppupomoon ensimmäisenä sen herätessä.' : 'Ylimenevä voima ja pidetyt lupaukset säästyvät tähän. Kun loppupomo herää, tämä isku osuu siihen ensimmäisenä.'}</span>{potFrom.length ? <span className="small pot-from">{potFrom.map((x) => `${x.label} ${fmt(x.value)}`).join(' · ')}</span> : null}</div>
      </div>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display">Taisteluloki</h2>
          <span className="muted small">päivittyy livenä</span>
        </div>
        {log.length ? (
          <ul className="log">
            {log.map((e, i) => (
              <li key={i}>
                {/* Treenikuva rivin vasemmassa reunassa. */}
                {e.photo ? <ZoomImg className="hit-photo" src={resizedImage(e.photo, 96)} full={e.photo} width={40} height={40} /> : null}
                <div style={{ minWidth: 0 }}>
                  <div><strong>{e.icon} {e.title}</strong>{e.crit ? <span className="tag">KRIITTINEN</span> : null}</div>
                  <div className="when">{e.by} · {formatDay(e.day)} · {ago(e.at)}</div>
                  {e.bonus ? <div className="bonus">{e.bonus}</div> : null}
                </div>
                <span className={`dmg${e.crit ? ' crit' : ''}`}>−{fmt(e.dmg)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Ei vielä iskuja tällä viikolla. Ole ensimmäinen!</p>}
        {recap ? <Link href={`/raportti/${recap.week}`} className="muted small tap">Viikon {recap.week} raportti →</Link> : null}
      </section>
    </>
  );
}
