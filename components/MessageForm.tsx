'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessage } from '@/app/actions';
import { MESSAGES_PER_DAY } from '@/lib/messages';

const MAX = 200;

/** Vapaa viesti porukalle. Tavallinen sankari voi lähettää kaksi päivässä, ylläpito rajatta. */
export default function MessageForm({ left, isAdmin }: { left: number; isAdmin: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await sendMessage(text);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setText('');
    setMsg({ ok: true, text: res.queued ? 'Viesti tallentui. Nyt on hiljaiset tunnit (22–09), joten ilmoitus lähtee kaikille aamulla klo 9.' : `Viesti lähti. Ilmoitus meni ${res.sent ?? 0} laitteeseen.` });
    router.refresh();
  }

  if (!isAdmin && left <= 0) {
    return <p className="muted" style={{ margin: 0 }}>Olet jo lähettänyt tämän päivän {MESSAGES_PER_DAY} viestiä. Seuraavan voit lähettää huomenna.</p>;
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="field">
        Viesti porukalle
        <textarea className="input" rows={4} style={{ padding: 12 }} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="Esim. Lähtekö joku huomenna aamulla lenkille? 🏃" />
      </label>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted small">{isAdmin ? '' : `Tänään jäljellä ${left}/${MESSAGES_PER_DAY}.`} Klo 22–09 ilmoitus lähtee vasta aamulla klo 9.</span>
        <span className={`small ${text.length > MAX - 20 ? 'error' : 'muted'}`}>{text.length}/{MAX}</span>
      </div>
      <button className="btn" type="submit" disabled={busy || !text.trim()}>{busy ? 'Lähetetään…' : '📣 Lähetä kaikille'}</button>
      {msg ? <p className={msg.ok ? 'ok' : 'error'} style={{ margin: 0 }} role="status">{msg.text}</p> : null}
    </form>
  );
}
