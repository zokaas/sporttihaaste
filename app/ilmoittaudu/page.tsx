'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, avatarUrl } from '@/lib/supabase/client';
import { weeklyPace } from '@/lib/rules';
import DayMonth from '@/components/DayMonth';

type Profile = {
  id: string;
  hero_name: string | null;
  avatar_path: string | null;
  name_day: string | null;
  birthday: string | null;
  pledge_hours: number | null;
  pledge_locked_at: string | null;
};

/** Rajaa kuvan keskeltä neliöksi ja pienentää 512 px:iin ennen latausta. */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function Ilmoittaudu() {
  const supabase = createClient();
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [team, setTeam] = useState({ locked: 0, hours: 0 });
  const [os, setOs] = useState<'ios' | 'android'>('ios');
  const [push, setPush] = useState<'off' | 'on' | 'denied' | 'unsupported'>('off');
  const [standalone, setStandalone] = useState(false);
  // Ennen syntymäpäivän kysymistä tunnuksen luonnissa luoduilta tileiltä kysytään se vaiheessa 1.
  const [needsBirthday, setNeedsBirthday] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace('/kirjaudu');
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setP(data as Profile);
      setNeedsBirthday(!data?.birthday);
      setPreview(avatarUrl(data?.avatar_path));
      const { data: all } = await supabase.from('profiles').select('id, pledge_hours, pledge_locked_at');
      const others = (all ?? []).filter((x) => x.pledge_locked_at && x.id !== user.id);
      setTeam({ locked: others.length, hours: others.reduce((a, x) => a + Number(x.pledge_hours), 0) });
    })();
    setOs(/android/i.test(navigator.userAgent) ? 'android' : 'ios');
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    if (!('Notification' in window) || !('PushManager' in window)) setPush('unsupported');
    else if (Notification.permission === 'granted') setPush('on');
    else if (Notification.permission === 'denied') setPush('denied');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return <p className="muted">Ladataan…</p>;

  async function save(patch: Partial<Profile>) {
    setBusy(true);
    setError('');
    const { error } = await supabase.from('profiles').update(patch).eq('id', p!.id);
    setBusy(false);
    if (error) {
      setError(error.code === '23505' ? 'Tämä sankarinimi on jo käytössä. Keksi toinen.' : error.message);
      return false;
    }
    setP({ ...p!, ...patch });
    return true;
  }

  async function uploadAvatar(file: File) {
    setBusy(true);
    setError('');
    const blob = await squareJpeg(file);
    const path = `${p!.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    setBusy(false);
    if (error) return setError('Kuvan lataus epäonnistui. Kokeile toista kuvaa.');
    setPreview(URL.createObjectURL(blob));
    await save({ avatar_path: path });
  }

  async function enablePush() {
    setError('');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return setPush('denied');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
    if (!res.ok) return setError('Ilmoitusten tallennus epäonnistui. Yritä uudelleen.');
    setPush('on');
  }

  const pledge = p.pledge_hours ?? 4;
  const teamHours = team.hours + pledge;

  async function next() {
    if (step === 1) {
      if (!p!.hero_name || p!.hero_name.trim().length < 2) return setError('Kirjoita sankarinimi (vähintään 2 merkkiä).');
      if (!p!.avatar_path) return setError('Lataa profiilikuva.');
      if (!p!.birthday) return setError('Valitse syntymäpäiväsi.');
      if (await save({ hero_name: p!.hero_name.trim(), birthday: p!.birthday })) setStep(2);
    } else if (step === 2) {
      if (await save({ pledge_hours: pledge, pledge_locked_at: new Date().toISOString() })) setStep(3);
    } else router.push('/');
  }

  const labels = ['Seuraava', 'Lukitse lupaus', 'Valmis'];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="display" style={{ fontSize: 22 }}>Monsterijahti</span>
        <span className="muted">Ilmoittautuminen, vaihe {step}/3. Valmiina ke 30.9. mennessä.</span>
        <div className="steps" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
      </div>

      {step === 1 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1 className="display">Kuka sinä olet sankarina?</h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {preview ? <img className="avatar" src={preview} alt="Profiilikuvasi" width={132} height={132} /> : <div className="avatar" style={{ width: 132, height: 132, border: '2px dashed #7a5a3a' }}>Ei kuvaa</div>}
            <label className="btn btn-ghost" style={{ minHeight: 44 }}>
              {preview ? 'Vaihda kuva' : 'Lataa kuva puhelimesta'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
            <span className="muted small">Kuva rajataan pyöreäksi.</span>
          </div>
          <label className="field">
            Sankarinimi
            <input className="input" maxLength={20} placeholder="Keksi itsellesi nimi" value={p.hero_name ?? ''} onChange={(e) => setP({ ...p, hero_name: e.target.value })} />
          </label>
          {needsBirthday ? <DayMonth label="Syntymäpäivä" value={p.birthday} onChange={(v) => setP({ ...p, birthday: v })} /> : null}
          <p className="muted" style={{ margin: 0 }}>Nimi ja kuva näkyvät kaikille. Niitä voi vaihtaa ke 30.9. asti.</p>
        </section>
      )}

      {step === 2 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1 className="display">Mitä lupaat?</h1>
          <p style={{ margin: 0 }}>Montako tuntia viikossa aiot treenata? Lupaa sen verran, mihin oikeasti pystyt. Tulostaulun ykkönen on se, joka pitää lupauksensa useimmin.</p>
          <div className="card">
            <div className="stepper">
              <button type="button" aria-label="Pienennä lupausta" onClick={() => setP({ ...p, pledge_hours: Math.max(1, pledge - 0.5) })}>−</button>
              <div className="value"><strong>{String(pledge).replace('.', ',')} h</strong><span className="muted">viikossa, {pledge * 100} vahinkoa</span></div>
              <button type="button" aria-label="Kasvata lupausta" onClick={() => setP({ ...p, pledge_hours: Math.min(15, pledge + 0.5) })}>+</button>
            </div>
          </div>
          <div className="note">
            <strong>{team.locked + (p.pledge_locked_at ? 1 : 0)}/10 lukinnut.</strong> Lupaukset yhteensä {String(teamHours).replace('.', ',')} h, eli porukan viikkovauhti on noin {Math.round(weeklyPace(teamHours)).toLocaleString('fi-FI')} vahinkoa.
          </div>
          <p className="muted" style={{ margin: 0 }}>Kauden aikana lupausta voi muuttaa kerran jokaisen monsterin aikana.</p>
        </section>
      )}

      {step === 3 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="display">Kotinäyttöön ja ilmoitukset päälle</h1>
          <p style={{ margin: 0 }}>Sunnuntaisin klo 18 saat muistutuksen, jos viikolta puuttuu jotain. Ilmoitukset toimivat vain, kun sovellus on puhelimen kotinäytöllä.</p>
          <div className="tabs" role="tablist" aria-label="Puhelin">
            <button role="tab" aria-selected={os === 'ios'} onClick={() => setOs('ios')}>iPhone</button>
            <button role="tab" aria-selected={os === 'android'} onClick={() => setOs('android')}>Android</button>
          </div>
          <ol className="guide">
            {os === 'ios' ? (
              <>
                <li>Avaa Monsterijahti Safarissa.</li>
                <li>Napauta alareunan Jaa-kuvaketta.</li>
                <li>Valitse Lisää Koti-valikkoon ja paina Lisää.</li>
                <li>Avaa sovellus kotinäytöltä ja palaa tähän vaiheeseen.</li>
              </>
            ) : (
              <>
                <li>Avaa Monsterijahti Chromessa.</li>
                <li>Napauta oikean yläkulman kolmea pistettä.</li>
                <li>Valitse Asenna sovellus tai Lisää aloitusnäytölle.</li>
                <li>Avaa sovellus aloitusnäytöltä ja palaa tähän vaiheeseen.</li>
              </>
            )}
          </ol>
          {push === 'on' ? (
            <p className="ok">Ilmoitukset ovat päällä.</p>
          ) : push === 'denied' ? (
            <p className="error">Ilmoitukset on estetty. Salli ne puhelimen asetuksista kohdasta Monsterijahti.</p>
          ) : push === 'unsupported' || (os === 'ios' && !standalone) ? (
            <p className="note">Ilmoitukset voi sallia, kun olet avannut sovelluksen kotinäytöltä.</p>
          ) : (
            <button className="btn btn-moss" type="button" onClick={enablePush}>Salli ilmoitukset</button>
          )}
        </section>
      )}

      {error ? <p className="error" role="alert">{error}</p> : null}

      <div className="row" style={{ marginTop: 'auto' }}>
        {step > 1 ? <button className="btn btn-ghost" type="button" onClick={() => setStep(step - 1)}>Takaisin</button> : null}
        <button className="btn grow" type="button" disabled={busy} onClick={next}>{labels[step - 1]}</button>
      </div>
    </>
  );
}
