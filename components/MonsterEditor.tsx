'use client';
import { shrinkJpeg } from '@/lib/image';
import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, monsterImageUrl } from '@/lib/supabase/client';
import { BOSS_WEEK } from '@/lib/season';
import { bossWhisper } from '@/lib/boss';
import { CATEGORIES, SPECIAL_WEAKNESSES, SPORTS, type Sport } from '@/lib/rules';
import { fallLine, stageTaunt, type Line } from '@/lib/taunts';
import type { MonsterPart } from '@/lib/trio';

export type Monster = {
  week: number;
  name: string | null;
  description: string | null;
  weakness: string | null;
  hp: number | null;
  hp_manual?: boolean;
  image_path: string | null;
  revealed_at: string | null;
  parts: Part[] | null;
  taunt_half?: string | null;
  taunt_low?: string | null;
  teaser?: string | null;
  boss_whisper?: string | null;
  hit_lines?: string | null;
  hit_crit?: string | null;
  taunt_full?: string | null;
  taunt_backlog?: string | null;
};

type PartLines = { taunt_backlog?: string | null; taunt_full?: string | null; taunt_half?: string | null; taunt_low?: string | null; hit_lines?: string | null; hit_crit?: string | null; fall_line?: string | null };
type Part = { name: string; description: string | null; weakness: string | null; image_path: string | null } & PartLines;
const LINE_KEYS = ['taunt_full', 'hit_lines', 'hit_crit', 'taunt_half', 'taunt_low', 'taunt_backlog', 'fall_line'] as const;
const emptyPart = (): Part => ({ name: '', description: null, weakness: null, image_path: null });

/** Lajilista tietokannasta (ylläpidon lisäämät mukana). */
const SportsContext = createContext<Sport[]>(SPORTS);

/** Heikkousvaihtoehdot: koko lajiryhmä tai yksittäinen laji. */
function WeaknessOptions() {
  const sports = useContext(SportsContext);
  return (
    <>
      <option value="">Ei heikkoutta</option>
      <optgroup label="Lajiryhmä (kaikki ryhmän lajit)">
        {CATEGORIES.map((w) => <option key={w} value={w}>{w}</option>)}
      </optgroup>
      <optgroup label="Erikoisheikkous">
        {Object.keys(SPECIAL_WEAKNESSES).map((w) => <option key={w} value={w}>{w} (mikä tahansa laji, kirjaaja merkitsee)</option>)}
      </optgroup>
      {CATEGORIES.map((c) => (
        <optgroup key={c} label={`Yksittäinen laji: ${c}`}>
          {sports.filter((s) => s.category === c).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}

export { shrinkJpeg };

function MonsterRow({ monster }: { monster: Monster }) {
  const router = useRouter();
  const [m, setM] = useState(monster);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const revealed = m.revealed_at ? new Date(m.revealed_at) : null;
  const isRevealed = Boolean(revealed && revealed.getTime() <= Date.now());
  const [hpInput, setHpInput] = useState(m.hp != null ? String(m.hp) : '');
  const partWord = (n: number) => (n === 2 ? 'kaksikko' : 'kolmikko');
  // Osien määrä: 0 = yksi monsteri, 2 = kaksikko, 3 = kolmikko. Olemassa olevat osat säilyvät.
  function setPartCount(n: number) {
    const cur = m.parts ?? [];
    setM({ ...m, parts: n ? Array.from({ length: n }, (_, i) => cur[i] ?? emptyPart()) : null });
  }
  async function saveHp() {
    const hp = Math.round(Number(hpInput));
    if (!Number.isFinite(hp) || hp < 100) return setMsg({ ok: false, text: 'Anna HP (vähintään 100).' });
    await save({ hp, hp_manual: true });
  }
  const img = monsterImageUrl(m.image_path);

  async function save(patch: Partial<Monster>) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from('monsters').update(patch).eq('week', m.week);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setM({ ...m, ...patch });
    setMsg({ ok: true, text: 'Tallennettu.' });
    router.refresh();
  }

  async function uploadFile(file: File, suffix = '') {
    setBusy(true);
    setMsg(null);
    const path = `week-${m.week}${suffix}-${Date.now()}.jpg`;
    const { error } = await createClient().storage.from('monsters').upload(path, await shrinkJpeg(file), { contentType: 'image/jpeg' });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: `Kuvan lataus epäonnistui: ${error.message}` }); return null; }
    return path;
  }

  async function upload(file: File) {
    const path = await uploadFile(file);
    if (path) await save({ image_path: path });
  }

  const parts = m.parts;
  const setPart = (i: number, patch: Partial<Part>) => setM({ ...m, parts: parts!.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  async function uploadPart(i: number, file: File) {
    const path = await uploadFile(file, `-osa${i + 1}`);
    if (!path) return;
    const next = parts!.map((x, j) => (j === i ? { ...x, image_path: path } : x));
    // Ensimmäisen osan kuva toimii myös monsterin pääkuvana (bestiaario, ilmoitukset).
    await save(i === 0 ? { parts: next, image_path: path } : { parts: next });
  }

  function saveAll() {
    const extras = { taunt_half: m.taunt_half?.trim() || null, taunt_low: m.taunt_low?.trim() || null, teaser: m.teaser?.trim() || null, boss_whisper: m.boss_whisper?.trim() || null, hit_lines: m.hit_lines?.trim() || null, hit_crit: m.hit_crit?.trim() || null, taunt_full: m.taunt_full?.trim() || null, taunt_backlog: m.taunt_backlog?.trim() || null };
    if (!parts) return save({ name: m.name?.trim() || null, description: m.description?.trim() || null, weakness: m.weakness, parts: null, ...extras });
    const clean = parts.map((x, i) => ({
      name: x.name.trim(), description: x.description?.trim() || null, weakness: x.weakness || null, image_path: x.image_path,
      // Osan omat repliikit; viimeinen osa ei kaadu ennen koko monsteria, joten sillä ei ole kaatumisrepliikkiä.
      ...Object.fromEntries(LINE_KEYS.map((k) => [k, k === 'fall_line' && i === parts.length - 1 ? null : x[k]?.trim() || null])),
    }));
    if (clean.some((x) => !x.name)) return setMsg({ ok: false, text: 'Anna jokaiselle kolmikon osalle nimi.' });
    const names = clean.map((x) => x.name);
    return save({
      parts: clean,
      name: `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`,
      description: m.description?.trim() || null,
      ...extras,
      weakness: clean[0].weakness,
    });
  }

  const [swapWith, setSwapWith] = useState('');

  // Vaihtaa tämän ja toisen viikon sisällön (nimi, kuvaus, heikkous, kuva, kolmikko). HP ja paljastusaika pysyvät viikolla.
  async function swap() {
    const other = Number(swapWith);
    if (!other) return;
    if (!confirm(`Vaihdetaanko viikkojen ${m.week} ja ${other} monsterit keskenään?`)) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const cols = 'name, description, weakness, image_path, parts, teaser, taunt_half, taunt_low, boss_whisper, hit_lines, hit_crit, taunt_full, taunt_backlog';
    const [{ data: a, error: e1 }, { data: b, error: e2 }] = await Promise.all([
      supabase.from('monsters').select(cols).eq('week', m.week).single(),
      supabase.from('monsters').select(cols).eq('week', other).single(),
    ]);
    const err = e1 ?? e2;
    if (err || !a || !b) { setBusy(false); return setMsg({ ok: false, text: err?.message ?? 'Monsteria ei löytynyt.' }); }
    const r1 = await supabase.from('monsters').update(b).eq('week', m.week);
    const r2 = r1.error ? r1 : await supabase.from('monsters').update(a).eq('week', other);
    setBusy(false);
    if (r2.error) return setMsg({ ok: false, text: r2.error.message });
    window.location.reload();
  }

  return (
    <details className="monster-row">
      <summary>
        <strong>Vko {m.week}</strong> {m.name ?? <span className="muted">nimeämättä</span>}
        {m.parts ? <span className="muted small"> · {partWord(m.parts.length)}</span> : null}
        {m.hp ? <span className="muted small"> · {m.hp.toLocaleString('fi-FI')} HP</span> : null}
        {!m.weakness && !m.parts && m.week !== BOSS_WEEK ? <span className="error small"> · heikkous puuttuu</span> : null}
        {!m.image_path ? <span className="error small"> · kuva puuttuu</span> : null}
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
        {isRevealed ? (
          <p className="muted small" style={{ margin: 0 }}>HP {m.hp?.toLocaleString('fi-FI') ?? '–'} · lukittu, koska monsteri on jo paljastunut.</p>
        ) : (
          <div className="field">
            HP (voi muuttaa, kunnes monsteri paljastuu)
            <div className="row" style={{ gap: 8 }}>
              <input className="input grow" style={{ minWidth: 0 }} type="number" inputMode="numeric" min={100} step={100} value={hpInput} onChange={(e) => setHpInput(e.target.value)} />
              <button type="button" className="btn btn-ghost" style={{ flex: '0 0 auto', paddingInline: 16 }} disabled={busy || hpInput === String(m.hp ?? '')} onClick={saveHp}>Tallenna</button>
            </div>
            {parts && Number(hpInput) > 0 ? <span className="muted small">{parts.length} × {Math.round(Number(hpInput) / parts.length).toLocaleString('fi-FI')} HP</span> : null}
            {m.hp_manual ? <span className="muted small">Asetettu käsin: uudelleenlukitus ei muuta tätä.</span> : null}
          </div>
        )}
        {m.week !== BOSS_WEEK ? (
          <label className="field">
            Monsterin muoto
            <select className="input" value={parts?.length ?? 0} onChange={(e) => setPartCount(Number(e.target.value))}>
              <option value={0}>Yksi monsteri</option>
              <option value={2}>Kaksikko (kaksi osaa, HP tasan)</option>
              <option value={3}>Kolmikko (kolme osaa, HP tasan)</option>
            </select>
          </label>
        ) : null}
        {parts ? parts.map((part, i) => {
          const src = monsterImageUrl(part.image_path);
          return (
            <fieldset key={i} className="card" style={{ margin: 0, gap: 10 }}>
              <legend className="small muted">Osa {i + 1}{i === parts.length - 1 ? ' (kaatuu viimeisenä, kun sinetti täyttyy)' : ''}</legend>
              {src ? <img src={src} alt="" style={{ width: '100%', borderRadius: 14 }} /> : null}
              <label className="btn btn-ghost" style={{ minHeight: 44 }}>
                {src ? 'Vaihda kuva' : 'Lataa kuva'}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadPart(i, e.target.files[0])} />
              </label>
              <label className="field">
                Nimi
                <input className="input" value={part.name} onChange={(e) => setPart(i, { name: e.target.value })} />
              </label>
              <label className="field">
                Kuvaus
                <textarea className="input" rows={5} style={{ padding: 12 }} value={part.description ?? ''} onChange={(e) => setPart(i, { description: e.target.value })} />
              </label>
              <label className="field">
                Heikkous
                <select className="input" value={part.weakness ?? ''} onChange={(e) => setPart(i, { weakness: e.target.value || null })}>
                  <WeaknessOptions />
                </select>
              </label>
              <details>
                <summary className="small">Repliikit: {part.name || `osa ${i + 1}`} {LINE_KEYS.some((k) => part[k]?.trim()) ? '✓' : <span className="muted">(tyhjä = yhteinen repliikki)</span>}</summary>
                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                  <label className="field">
                    Täydellä HP:lla
                    <input className="input" value={part.taunt_full ?? ''} onChange={(e) => setPart(i, { taunt_full: e.target.value })} />
                  </label>
                  <label className="field">
                    Iskureaktiot (yksi per rivi)
                    <textarea className="input" rows={3} style={{ padding: 12 }} value={part.hit_lines ?? ''} onChange={(e) => setPart(i, { hit_lines: e.target.value })} />
                  </label>
                  <label className="field">
                    Kriittinen isku
                    <input className="input" value={part.hit_crit ?? ''} onChange={(e) => setPart(i, { hit_crit: e.target.value })} />
                  </label>
                  <label className="field">
                    HP alle 50 %
                    <input className="input" value={part.taunt_half ?? ''} onChange={(e) => setPart(i, { taunt_half: e.target.value })} />
                  </label>
                  <label className="field">
                    HP alle 20 %
                    <input className="input" value={part.taunt_low ?? ''} onChange={(e) => setPart(i, { taunt_low: e.target.value })} />
                  </label>
                  <label className="field">
                    Rästissä (jäi kaatumatta omalla viikollaan)
                    <input className="input" value={part.taunt_backlog ?? ''} onChange={(e) => setPart(i, { taunt_backlog: e.target.value })} />
                  </label>
                  {i < parts.length - 1 ? (
                    <label className="field">
                      Kun {part.name || 'tämä osa'} kaatuu (sanoo {parts[i + 1].name || `osa ${i + 2}`})
                      <input className="input" value={part.fall_line ?? ''} onChange={(e) => setPart(i, { fall_line: e.target.value })} />
                    </label>
                  ) : null}
                </div>
              </details>
            </fieldset>
          );
        }) : null}
        {!parts && img ? <img src={img} alt="" style={{ width: '100%', borderRadius: 14 }} /> : null}
        {!parts ? (
          <label className="btn btn-ghost" style={{ minHeight: 44 }}>
            {img ? 'Vaihda kuva' : 'Lataa kuva'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        ) : null}
        {!parts ? (
          <label className="field">
            Nimi
            <input className="input" value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </label>
        ) : null}
        <label className="field">
          {parts ? 'Yhteinen kuvaus' : 'Kuvaus'}
          <textarea className="input" rows={8} style={{ padding: 12 }} value={m.description ?? ''} onChange={(e) => setM({ ...m, description: e.target.value })} />
        </label>
        <label className="field">
          {m.week === 1 ? 'Arvoitus (näkyy etusivulla ennen kauden alkua, ma 28.9. alkaen)' : 'Arvoitus (näkyy kaikille edellisen viikon perjantaista alkaen)'}
          <textarea className="input" rows={2} style={{ padding: 12 }} placeholder="Esim. Ensi viikolla vastaan tulee jotain, mikä pelkää palloja…" value={m.teaser ?? ''} onChange={(e) => setM({ ...m, teaser: e.target.value })} />
        </label>
        {parts ? <p className="small muted" style={{ margin: 0 }}>Yhteiset repliikit alla: käytetään, kun osalla ei ole omaa. Kaatunut osa vaikenee.</p> : null}
        <label className="field">
          Repliikki täydellä HP:lla (ennen kuin sitä on lyöty kunnolla)
          <input className="input" placeholder="Tulkaa vain, sankarit. Olen odottanut teitä." value={m.taunt_full ?? ''} onChange={(e) => setM({ ...m, taunt_full: e.target.value })} />
        </label>
        <label className="field">
          Iskureaktiot (yksi per rivi, arvotaan omaan iskuun)
          <textarea className="input" rows={4} style={{ padding: 12 }} placeholder={'Auts!\nTuoko oli kaikki?\nKutittaa.'} value={m.hit_lines ?? ''} onChange={(e) => setM({ ...m, hit_lines: e.target.value })} />
        </label>
        <label className="field">
          Reaktio kriittiseen iskuun
          <input className="input" placeholder="AARGH! Mistä tuo tuli?!" value={m.hit_crit ?? ''} onChange={(e) => setM({ ...m, hit_crit: e.target.value })} />
        </label>
        <label className="field">
          Repliikki, kun HP alle 50 %
          <input className="input" placeholder="Tuo sattui. Mutta pelkkä naarmu, sankarit!" value={m.taunt_half ?? ''} onChange={(e) => setM({ ...m, taunt_half: e.target.value })} />
        </label>
        <label className="field">
          Repliikki, kun HP alle 20 %
          <input className="input" placeholder="Ei… ei vielä… minä en kaadu näin helposti!" value={m.taunt_low ?? ''} onChange={(e) => setM({ ...m, taunt_low: e.target.value })} />
        </label>
        {m.week < BOSS_WEEK ? (
          <label className="field">
            Repliikki rästissä (jäi kaatumatta omalla viikollaan)
            <input className="input" placeholder="Ette saaneet minua kaatumaan. Minä jatkan." value={m.taunt_backlog ?? ''} onChange={(e) => setM({ ...m, taunt_backlog: e.target.value })} />
          </label>
        ) : null}
        <LinePreview m={m} />
        {m.week < BOSS_WEEK ? (
          <label className="field">
            Loppupomon kuiskaus, kun tämä monsteri kaatuu
            <input className="input" placeholder={bossWhisper(m.week) ?? ''} value={m.boss_whisper ?? ''} onChange={(e) => setM({ ...m, boss_whisper: e.target.value })} />
          </label>
        ) : null}
        {!parts ? (
          <label className="field">
            Heikkous
            <select className="input" value={m.weakness ?? ''} onChange={(e) => setM({ ...m, weakness: e.target.value || null })}>
              <WeaknessOptions />
            </select>
          </label>
        ) : null}
        <p className="muted small" style={{ margin: 0 }}>
          HP {m.hp?.toLocaleString('fi-FI') ?? 'lukitsematta'}.{' '}
          {revealed ? `Paljastuu kaikille ${revealed.toLocaleString('fi-FI', { timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : 'Paljastusaikaa ei ole asetettu.'}
        </p>
        {m.week !== BOSS_WEEK ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <select className="input grow" style={{ minWidth: 0 }} value={swapWith} onChange={(e) => setSwapWith(e.target.value)} aria-label="Vaihda paikkaa viikon kanssa">
              <option value="">Vaihda paikkaa viikon kanssa…</option>
              {Array.from({ length: BOSS_WEEK - 1 }, (_, i) => i + 1).filter((w) => w !== m.week).map((w) => <option key={w} value={w}>Viikko {w}</option>)}
            </select>
            <button type="button" className="btn btn-ghost" style={{ flexShrink: 0 }} disabled={busy || !swapWith} onClick={swap}>Vaihda</button>
          </div>
        ) : null}
        <button className="btn" type="button" disabled={busy} onClick={saveAll}>
          {busy ? 'Tallennetaan…' : 'Tallenna'}
        </button>
        {msg ? <p className={msg.ok ? 'ok' : 'error'} style={{ margin: 0 }}>{msg.text}</p> : null}
      </div>
    </details>
  );
}

export default function MonsterEditor({ monsters, sports }: { monsters: Monster[]; sports: Sport[] }) {
  return (
    <SportsContext.Provider value={sports}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{monsters.map((m) => <MonsterRow key={m.week} monster={m} />)}</div>
    </SportsContext.Provider>
  );
}

/** Puhekuplat esikatselussa samalla tyylillä kuin näyttämöllä. */
function Bubbles({ title, lines }: { title: string; lines: Line[] }) {
  if (!lines.length) return null;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span className="small" style={{ color: '#c9c1b4' }}>{title}</span>
      {lines.map((l, i) => (
        <div key={i} className="stage-taunt" style={{ maxWidth: '100%', margin: 0 }}>
          {l.who ? <b className="stage-taunt-who">{l.who}</b> : null}“{l.text}”
        </div>
      ))}
    </div>
  );
}

/** Repliikkien esikatselu tallentamattomista kentistä: mitä pelaajat näkevät missäkin tilanteessa. */
function LinePreview({ m }: { m: Monster }) {
  const hp = m.hp && m.hp > 0 ? m.hp : 1000;
  const parts = (m.parts ?? null) as unknown as MonsterPart[] | null;
  const speaker = { ...m, hp, parts };
  const rows = (s?: string | null) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const common = (s?: string | null): Line[] => rows(s).map((text) => ({ who: null, text }));
  const hits: Line[] = parts?.some((p) => rows(p.hit_lines).length)
    ? parts.flatMap((p) => rows(p.hit_lines).map((text) => ({ who: p.name, text })))
    : common(m.hit_lines);
  const crits: Line[] = parts?.some((p) => p.hit_crit?.trim())
    ? parts.filter((p) => p.hit_crit?.trim()).map((p) => ({ who: p.name, text: p.hit_crit!.trim() }))
    : common(m.hit_crit);
  return (
    <details>
      <summary className="small">Esikatsele repliikit</summary>
      <div style={{ display: 'grid', gap: 14, marginTop: 10, padding: 14, borderRadius: 14, background: 'var(--deep)' }}>
        <Bubbles title="Täysi HP" lines={stageTaunt(speaker, hp) ?? []} />
        <Bubbles title="Iskureaktiot (yksi arvotaan)" lines={hits} />
        <Bubbles title="Kriittinen isku" lines={crits} />
        {parts?.slice(0, -1).map((p, i) => <Bubbles key={i} title={`Kun ${p.name || `osa ${i + 1}`} kaatuu (myös ilmoituksena)`} lines={[fallLine(parts, i)].filter((l): l is Line => Boolean(l))} />)}
        <Bubbles title="HP alle 50 %" lines={stageTaunt(speaker, hp * 0.45) ?? []} />
        <Bubbles title="HP alle 20 %" lines={stageTaunt(speaker, hp * 0.1) ?? []} />
        {m.week < BOSS_WEEK ? <Bubbles title="Rästissä" lines={stageTaunt(speaker, hp * 0.7, true) ?? []} /> : null}
        <span className="small" style={{ color: '#c9c1b4' }}>Tyhjät kentät näkyvät oletusrepliikkeinä. Moniosaisella kaatunut osa vaikenee.</span>
      </div>
    </details>
  );
}
