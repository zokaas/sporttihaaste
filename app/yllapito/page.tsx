import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import { seasonHp } from '@/lib/rules';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const dm = (v: string | null) => (v ? `${Number(v.split('-')[1])}.${Number(v.split('-')[0])}.` : '–');

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) redirect('/');
  return supabase;
}

async function lockSeason() {
  'use server';
  const supabase = await requireAdmin();
  await supabase.rpc('lock_season');
  revalidatePath('/yllapito');
}

async function sendTestPush() {
  'use server';
  const supabase = await requireAdmin();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  await Promise.allSettled(
    (subs ?? []).map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: 'Monsterijahti', body: 'Testi-ilmoitus toimii. Nähdään torstaina!', url: '/' }),
      ),
    ),
  );
}

export default async function Yllapito() {
  const supabase = await requireAdmin();
  const [{ data: heroes }, { data: subs }, { data: season }, { data: monsters }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('push_subscriptions').select('user_id'),
    supabase.from('season').select('*').single(),
    supabase.from('monsters').select('*').order('week'),
  ]);
  const withPush = new Set((subs ?? []).map((s) => s.user_id));
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const total = locked.reduce((a, h) => a + Number(h.pledge_hours), 0);
  const preview = seasonHp(total);

  return (
    <>
      <h1 className="display">Ylläpito</h1>

      <section className="card">
        <h2 className="display">Ilmoittautuneet {locked.length}/10</h2>
        <div className="scroll">
          <table className="admin">
            <thead><tr><th>Sankari</th><th>Lupaus</th><th>Nimip.</th><th>Synttärit</th><th>Ilmoit.</th></tr></thead>
            <tbody>
              {(heroes ?? []).map((h) => {
                const src = avatarUrl(h.avatar_path);
                return (
                  <tr key={h.id}>
                    <td>
                      <div className="row" style={{ alignItems: 'center' }}>
                        {src ? <img className="avatar" src={src} alt="" width={32} height={32} /> : <div className="avatar" style={{ width: 32, height: 32 }}>?</div>}
                        {h.hero_name ?? <span className="muted">Kesken</span>}
                      </div>
                    </td>
                    <td>{h.pledge_locked_at ? `${String(h.pledge_hours).replace('.', ',')} h` : <span className="muted">ei lukittu</span>}</td>
                    <td>{dm(h.name_day)}</td>
                    <td>{dm(h.birthday)}{h.birthday && h.birth_year ? h.birth_year : ''}</td>
                    <td>{withPush.has(h.id) ? 'päällä' : <span className="error">ei</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={sendTestPush}><button className="btn btn-ghost" type="submit">Lähetä testi-ilmoitus kaikille</button></form>
      </section>

      <section className="card">
        <h2 className="display">Tavoite</h2>
        {season?.hp_locked_at ? (
          <p className="ok" style={{ margin: 0 }}>
            Lukittu {new Date(season.hp_locked_at).toLocaleString('fi-FI')}: lupaukset {String(season.total_pledge_hours).replace('.', ',')} h, viikkovauhti {fmt(season.pace)}.
          </p>
        ) : (
          <p style={{ margin: 0 }}>Esikatselu nykyisillä lupauksilla ({String(total).replace('.', ',')} h): viikkovauhti {fmt(preview.pace)}.</p>
        )}
        <div className="scroll">
          <table className="admin">
            <thead><tr><th>Viikko</th><th>Monsteri</th><th>HP</th></tr></thead>
            <tbody>
              {(monsters ?? []).map((m) => (
                <tr key={m.week}>
                  <td>{m.week}</td>
                  <td>{m.week === 11 ? 'Loppupomo' : m.name ?? <span className="muted">nimeämättä</span>}</td>
                  <td>{fmt(season?.hp_locked_at ? m.hp : m.week === 11 ? preview.boss : preview.monsters[m.week - 1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: 0 }}>Pottikatto on puolet loppupomon HP:sta. Lukitse tavoite, kun kaikki ovat ilmoittautuneet. Lukituksen voi tehdä uudelleen, jos joku ilmoittautuu myöhässä.</p>
        <form action={lockSeason}><button className="btn" type="submit">{season?.hp_locked_at ? 'Laske ja lukitse uudelleen' : 'Lukitse tavoite'}</button></form>
      </section>
    </>
  );
}
