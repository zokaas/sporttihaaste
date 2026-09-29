import { redirect } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import MessageForm from '@/components/MessageForm';
import DeleteMessage from '@/components/DeleteMessage';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { helsinkiMs, helsinkiToday } from '@/lib/season';
import { MESSAGES_PER_DAY, MESSAGES_PER_PAGE } from '@/lib/messages';

export const dynamic = 'force-dynamic';

type Message = { id: number; body: string; created_at: string; sender: string; profiles: { hero_name: string | null; avatar_path: string | null } | null };

const when = (iso: string) =>
  new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default async function Viestit({ searchParams }: { searchParams: { sivu?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const page = Math.max(1, Math.floor(Number(searchParams.sivu) || 1));
  const from = (page - 1) * MESSAGES_PER_PAGE;
  // Tämän päivän omat viestit päivärajaa varten (Suomen päivän alusta).
  const since = new Date(helsinkiMs(helsinkiToday(), '00:00:00')).toISOString();
  const [{ data: me }, { data, error, count }, { count: mine }] = await Promise.all([
    supabase.from('profiles').select('hero_name, pledge_locked_at, is_admin').eq('id', user.id).single(),
    supabase.from('messages').select('id, body, created_at, sender, profiles(hero_name, avatar_path)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + MESSAGES_PER_PAGE - 1),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender', user.id).gte('created_at', since),
  ]);
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  const messages = (data ?? []) as unknown as Message[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / MESSAGES_PER_PAGE));
  const left = Math.max(0, MESSAGES_PER_DAY - (mine ?? 0));

  return (
    <>
      <Nav current="/viestit" />
      <h1 className="display">Viestit</h1>
      <section className="card">
        {error ? <p className="error" style={{ margin: 0 }}>Viestit eivät ole vielä käytössä. Ylläpitäjän pitää ajaa migraatio 011_viestit.sql.</p>
          : <MessageForm left={left} isAdmin={Boolean(me.is_admin)} />}
      </section>

      <section className="card" id="viestit">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display">{page === 1 ? 'Viimeisimmät' : 'Vanhemmat'}</h2>
          {pages > 1 ? <span className="muted small">Sivu {page}/{pages}</span> : null}
        </div>
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
        ) : <p className="muted" style={{ margin: 0 }}>{page === 1 ? 'Ei vielä viestejä. Aloita sinä!' : 'Tällä sivulla ei ole viestejä.'}</p>}
        {pages > 1 ? (
          // Sivunvaihto vie viestilistan alkuun (#viestit), ei koko sivun yläreunaan.
          <nav className="pager" aria-label="Viestisivut">
            {page > 1 ? <Link className="btn btn-ghost" href={page === 2 ? '/viestit#viestit' : `/viestit?sivu=${page - 1}#viestit`}>← Uudemmat</Link> : <span />}
            {page < pages ? <Link className="btn btn-ghost" href={`/viestit?sivu=${page + 1}#viestit`}>Vanhemmat →</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </>
  );
}
