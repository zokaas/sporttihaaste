import { redirect } from 'next/navigation';
import PushToggle from '@/components/PushToggle';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import BossShadow from '@/components/BossShadow';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');

  const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');

  const { data: heroes } = await supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at').order('created_at');
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const img = avatarUrl(me.avatar_path);

  return (
    <>
      <div className="row" style={{ alignItems: 'center' }}>
        {img ? <img className="avatar" src={img} alt="" width={56} height={56} /> : null}
        <div className="grow">
          <h1 className="display" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{me.hero_name}</h1>
          <p className="muted" style={{ margin: 0 }}>Lupaus {String(me.pledge_hours).replace('.', ',')} h viikossa</p>
        </div>
      </div>

      <BossShadow>
        <h2 className="display brand" style={{ fontSize: 32, color: 'var(--light)' }}>Se odottaa</h2>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kausi alkaa torstaina 1.10. Ensimmäinen vastus on Willa Rykman. Loppupomo herää 14.12.</p>
      </BossShadow>

      <section className="card">
        <h2 className="display">Sankarit {locked.length}/10</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 12 }}>
          {(heroes ?? []).map((h) => {
            const src = avatarUrl(h.avatar_path);
            return (
              <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: h.pledge_locked_at ? 1 : 0.45 }}>
                {src ? <img className="avatar" src={src} alt="" width={48} height={48} /> : <div className="avatar" style={{ width: 48, height: 48 }}>?</div>}
                <span className="small" style={{ textAlign: 'center', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{h.hero_name ?? 'Kesken'}</span>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ margin: 0 }}>Monsterien HP lasketaan kaikkien lupauksista, kun ilmoittautuminen sulkeutuu ke 30.9.</p>
      </section>

      <section className="card">
        <h2 className="display">Ilmoitukset</h2>
        <PushToggle />
      </section>

      <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link>
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}
