'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isValidUsername, normalizeUsername, usernameToEmail } from '@/lib/username';
import BossShadow from '@/components/BossShadow';
import DayMonth from '@/components/DayMonth';

export default function Kirjaudu() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [birthday, setBirthday] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = normalizeUsername(username);
    if (!isValidUsername(name)) {
      setError('Käyttäjänimessä saa olla 3–20 merkkiä: kirjaimia a–z, numeroita, piste, viiva tai alaviiva.');
      return;
    }
    if (password.length < 6) {
      setError('Salasanassa pitää olla vähintään 6 merkkiä.');
      return;
    }
    if (mode === 'signup' && password !== password2) {
      setError('Salasanat eivät täsmää.');
      return;
    }
    if (mode === 'signup' && (!birthday || !birthYear)) {
      setError('Valitse syntymäpäiväsi.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const email = usernameToEmail(name);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Väärä käyttäjänimi tai salasana.');
        setBusy(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(/already/i.test(error.message) ? 'Käyttäjänimi on jo varattu. Valitse toinen tai kirjaudu sisään.' : 'Tunnuksen luonti epäonnistui. Yritä uudelleen.');
        setBusy(false);
        return;
      }
      if (!data.session) {
        setError('Tunnus luotiin, mutta kirjautuminen ei onnistunut. Ylläpitäjä: kytke Supabasessa "Confirm email" pois päältä.');
        setBusy(false);
        return;
      }
      // Profiilirivi syntyy tietokannassa tunnuksen mukana. Jos tallennus epäonnistuu, ilmoittautuminen kysyy päivän uudelleen.
      await supabase.from('profiles').update({ birthday, birth_year: birthYear }).eq('id', data.session.user.id);
    }
    router.replace('/');
    router.refresh();
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPassword2('');
  }

  return (
    <>
      <BossShadow>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--light)' }}>Monsterijahti</h1>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kymmenen monsteria, yksi loppupomo ja kymmenen sankaria. Kausi 1.10.–20.12.</p>
      </BossShadow>

      <form className="card" onSubmit={submit}>
        <h2 className="display">{mode === 'login' ? 'Kirjaudu' : 'Luo tunnus'}</h2>
        <label className="field">
          Käyttäjänimi
          <input className="input" type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          Salasana
          <input className="input" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {mode === 'signup' ? (
          <label className="field">
            Salasana uudelleen
            <input className="input" type="password" required autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </label>
        ) : null}
        {mode === 'signup' ? (
          <>
            <DayMonth label="Syntymäpäivä" value={birthday} onChange={setBirthday} year={birthYear} onYearChange={setBirthYear} />
            <p className="muted small" style={{ margin: 0 }}>Syntymäpäivänäsi kaikkien iskut tekevät +50 %.</p>
          </>
        ) : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Hetki…' : mode === 'login' ? 'Kirjaudu' : 'Luo tunnus'}
        </button>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <p className="small" style={{ marginBottom: 0 }}>
          {mode === 'login' ? 'Ensimmäinen kerta? ' : 'Onko sinulla jo tunnus? '}
          <button type="button" onClick={switchMode} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }}>
            {mode === 'login' ? 'Luo tunnus' : 'Kirjaudu sisään'}
          </button>
        </p>
      </form>
    </>
  );
}
