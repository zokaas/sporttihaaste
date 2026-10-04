import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import MonsterStage from '@/components/MonsterStage';
import { requireHero } from '@/lib/page';
import { avatarUrl, hitPhotoUrl, monsterImageUrl, resizedImage } from '@/lib/supabase/client';
import { finalBlows } from '@/lib/stats';
import { STEP_DAY_DAMAGE, hitBonusText, sealView } from '@/lib/rules';
import { formatDay, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';
import { activeWeaknesses, groupName, stageParts } from '@/lib/trio';
import Hint from '@/components/Hint';
import { ZoomImg } from '@/components/ImageViewer';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const helsinki = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', ...opts }).format(new Date(ms));

export default async function Monsteri({ params }: { params: { week: string } }) {
  const { battle: b } = await requireHero();
  const week = Number(params.week);
  if (!Number.isInteger(week) || week < 1 || week > BOSS_WEEK || week > b.week) notFound();

  const m = b.monsters.get(week);
  const title = m?.name ?? (week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${week} monsteri`);
  const fighter = b.ledger?.alive.find((f) => f.week === week);
  const view = fighter ? sealView(fighter, b.required) : null;
  const killed = b.ledger?.killed.find((k) => k.week === week);
  const blow = finalBlows(b)[week];
  const heroName = (id: string) => b.heroes.find((h) => h.id === id)?.hero_name ?? 'Megamarssi';
  const { start, end } = weekRange(week);
  // Kaatuneella ei näytetä heikkoutta; elossa olevalla vain vuorossa olevan osan heikkous (kuten taistelussa).
  const weak = killed ? '' : activeWeaknesses(m, view ? view.hp : m?.hp ?? 0).join(', ');
  const parts = stageParts(m, killed ? 0 : view?.hp ?? m?.hp ?? 0, Boolean(killed), monsterImageUrl);

  // Kuvat koko ruudulle: kaksikolla ja kolmikolla osien kuvat, muuten monsterin kuva.
  const partImages = (parts ?? []).map((x) => x.image).filter((x): x is string => Boolean(x));
  const images = partImages.length ? partImages : [monsterImageUrl(m?.image_path)].filter((x): x is string => Boolean(x));

  // Vahinko monsterin viikolla (iskut, askeleet ja Kela) sankareittain
  const totals = new Map<string, number>();
  for (const h of b.hits) if (seasonWeek(h.trained_on) === week) totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + h.damage);
  for (const s of b.steps) if (seasonWeek(s.day) === week) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const kela = b.kela.filter((k) => seasonWeek(k.day) === week).sort((a, c) => c.day.localeCompare(a.day));
  for (const k of kela) totals.set(k.userId, (totals.get(k.userId) ?? 0) + k.damage);
  const top = [...totals].sort((a, c) => c[1] - a[1]).slice(0, 5);
  const hits = b.hits.filter((h) => seasonWeek(h.trained_on) === week).sort((a, c) => c.created_at.localeCompare(a.created_at));
  const photos = hits.filter((h) => h.photo_path);

  return (
    <>
      <Nav current="/bestiaario" />
      <MonsterStage
        week={week}
        title={title}
        image={monsterImageUrl(m?.image_path)}
        weakness={weak || null}
        parts={parts}
        hp={killed ? 0 : view ? view.hp : m?.hp ?? 0}
        maxHp={m?.hp ?? 1}
        padded={view?.dam ?? 0}
        backlog={week < b.week && !killed}
        revealed={Boolean(m?.name)}
        dead={Boolean(killed)}
        ownHit={null}
        zoom={m?.name ? images : undefined}
      />
      {m?.description ? <p className="narrator">{m.description}</p> : null}

      {parts && m?.parts ? (
        <section className="card">
          <Hint id="trio" title={<h2 className="display">{groupName(m!.parts!.length)}</h2>}>Osat jakavat viikon HP:n tasan ja kaatuvat järjestyksessä. Viimeinen kaatuu vasta, kun sinetti on täynnä.</Hint>
          <ul className="people">
            {m.parts.map((part, i) => (
              <li key={i} style={parts[i].dead ? { opacity: 0.6 } : undefined}>
                {parts[i].image ? <ZoomImg className="avatar" src={parts[i].image!} width={56} height={56} style={parts[i].dead ? { filter: 'grayscale(1)' } : undefined} /> : <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{parts[i].dead ? '✝' : i + 1}</div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{part.name}</div>
                  <div className="facts">{parts[i].dead ? <span className="ok">Kaatunut</span> : `${fmt(parts[i].left)} / ${fmt(parts[i].hp)} HP`}{part.weakness ? ` · heikkous ${part.weakness}` : ''}</div>
                  {part.description ? <div className="facts keep-lines">{part.description}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Viikko</span><span>{week} · {formatDay(start)}–{formatDay(end)}</span></div>
        {weak ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Heikkous</span><span>{weak} (+50 %)</span></div> : null}
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Tila</span>
          <span>{killed?.killedAt ? <span className="ok">Kaatui {helsinki(killed.killedAt, { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
            : view?.dam ? <span style={{ color: 'var(--gold)' }}>{fmt(view.hp)} HP, sinettirajalla</span>
            : view ? `${fmt(view.hp)} / ${fmt(m?.hp ?? 0)} HP` : '–'}</span>
        </div>
        {blow ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Viimeinen isku</span><Link href={`/sankari/${blow}`}>⚔️ {heroName(blow)}</Link></div> : null}
      </section>

      {top.length ? (
        <section className="card">
          <h2 className="display">Eniten voimaa</h2>
          <ul className="people">
            {top.map(([id, dmg], i) => {
              const h = b.heroes.find((x) => x.id === id);
              const src = avatarUrl(h?.avatar_path ?? null);
              return (
                <li key={id}>
                  <span className="rank">{i + 1}.</span>
                  <Link href={`/sankari/${id}`} className="rowlink row grow" style={{ alignItems: 'center' }}>
                    {src ? <img className="avatar" src={src} alt="" width={36} height={36} /> : <div className="avatar" style={{ width: 36, height: 36 }}>{(h?.hero_name ?? '?').slice(0, 1)}</div>}
                    <span className="grow who">{h?.hero_name}</span>
                    <strong>{fmt(dmg)}</strong>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {photos.length ? (
        <section className="card">
          <h2 className="display">Viikon {week} treenikuvat <span className="muted small">{photos.length}</span></h2>
          <div className="photo-grid">
            {photos.map((h) => {
              const src = hitPhotoUrl(h.photo_path)!;
              return (
                <figure key={h.id} style={{ margin: 0 }}>
                  <ZoomImg className="photo-grid-img" src={resizedImage(src, 256)} full={src} width={110} height={110} />
                  <figcaption className="muted small"><strong>{heroName(h.user_id)}</strong><br />{h.sport} · {formatDay(h.trained_on)}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="display">Iskut</h2>
        {hits.length || kela.length ? (
          <ul className="people">
            {hits.map((h, i) => (
              <li key={i}>
                {hitPhotoUrl(h.photo_path) ? <ZoomImg className="hit-photo" src={resizedImage(hitPhotoUrl(h.photo_path)!, 96)} full={hitPhotoUrl(h.photo_path)!} width={40} height={40} /> : null}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{heroName(h.user_id)} <span className="muted" style={{ fontWeight: 400 }}>· {h.sport} {h.minutes} min</span></div>
                  <div className="facts">
                    {formatDay(h.trained_on)}
                    {h.companions.length ? ` · mukana ${h.companions.map(heroName).join(', ')}` : ''}
                    {h.all_together ? ' · kaikki yhdessä!' : ''}
                  </div>
                  {hitBonusText(h) ? <div className="facts bonus">{hitBonusText(h)}</div> : null}
                </div>
                <strong>{fmt(h.damage)}</strong>
              </li>
            ))}
            {kela.map((k) => (
              <li key={`kela-${k.userId}-${k.day}`}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{heroName(k.userId)} <span className="muted" style={{ fontWeight: 400 }}>· 🏥 Kela</span></div>
                  <div className="facts">{formatDay(k.day)} · sairaspäivä</div>
                </div>
                <strong>{fmt(k.damage)}</strong>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Kukaan ei ole vielä lyönyt.</p>}
      </section>
    </>
  );
}
