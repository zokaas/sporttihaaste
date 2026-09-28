import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import MessageForm from '@/components/MessageForm';
import DeleteMessage from '@/components/DeleteMessage';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { helsinkiToday } from '@/lib/season';

export const dynamic = 'force-dynamic';

type Message = { id: number; body: string; created_at: string; sender: string; profiles: { hero_name: string | null; avatar_path: string | null } | null };

const when = (iso: string) =>
  new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default async function Viestit() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const [{ data: me }, { data, error }] = await Promise.all([
    supabase.from('profiles').select('hero_name, pledge_locked_at, is_admin').eq('id', user.id).single(),
    supabase.from('messages').select('id, body, created_at, sender, profiles(hero_name, avatar_path)').order('created_at', { ascending: false }).limit(50),
  ]);
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  const messages = (data ?? []) as unknown as Message[];
  const day = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));
  const sentToday = messages.some((m) => m.sender === user.id && day(m.created_at) === helsinkiToday());

  return (
    <>
      <Nav current="/viestit" />
      <h1 className="display">Viestit</h1>
      <section className="card">
        {error ? <p className="error" style={{ margin: 0 }}>Viestit eivät ole vielä käytössä. Ylläpitäjän pitää ajaa migraatio 011_viestit.sql.</p>
          : <MessageForm canSend={Boolean(me.is_admin) || !sentToday} isAdmin={Boolean(me.is_admin)} />}
      </section>

      <section className="card">
        <h2 className="display">Viimeisimmät</h2>
        {messages.length ? (
          <ul className="people">
            {messages.map((m) => {
              const src = avatarUrl(m.profiles?.avatar_path ?? null);
              const name = m.profiles?.hero_name ?? 'Sankari';
              return (
                <li key={m.id} style={{ alignItems: 'flex-start' }}>
                  {src ? <img className="avatar" src={src} alt="" width={36} height={36} /> : <div className="avatar" style={{ width: 36, height: 36 }}>{name.slice(0, 1)}</div>}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="who">{name} <span className="muted small" style={{ fontWeight: 400 }}>· {when(m.created_at)}</span></div>
                    <p className="message-body">{m.body}</p>
                    {me.is_admin ? <DeleteMessage id={m.id} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Ei vielä viestejä. Aloita sinä!</p>}
      </section>
    </>
  );
}
