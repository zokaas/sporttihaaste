import Link from 'next/link';
import UnreadDot from '@/components/UnreadDot';
import InstallHint from '@/components/InstallHint';
import NightVisit from '@/components/NightVisit';
import { navVisibility } from '@/lib/nav';

const LEFT = [
  { href: '/', label: 'Taistelu', icon: '👹' },
  { href: '/mina', label: 'Minä', icon: '👤' },
];
const RIGHT = [
  { href: '/sankarit', label: 'Sankarit', icon: '🛡️' },
  { href: '/bestiaario', label: 'Bestiaario', icon: '📖' },
];

/** Yläpalkki (viestit ja säännöt) ja peukalon ulottuvilla oleva alapalkki, jonka keskellä on Lyö. */
export default async function Nav({ current }: { current: string }) {
  const show = await navVisibility();
  const right = RIGHT.filter((l) => l.href !== '/bestiaario' || show.bestiary);
  const tab = (l: (typeof LEFT)[number]) => (
    <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}>
      <span aria-hidden="true">{l.icon}</span>
      {l.label}
    </Link>
  );
  return (
    <>
      <header className="topbar">
        <span className="display topbar-title">Monsterijahti</span>
        <Link href="/viestit" className="topbar-icon" aria-label="Viestit" aria-current={current === '/viestit' ? 'page' : undefined}>📣<UnreadDot seenNow={current === '/viestit'} /></Link>
        <Link href="/saannot" className="topbar-icon" aria-label="Säännöt" aria-current={current === '/saannot' ? 'page' : undefined}>?</Link>
      </header>
      <InstallHint />
      <NightVisit />
      {show.bossRealm ? (
        <div className="boss-realm" aria-hidden="true">
          <svg className="realm-crack tl" viewBox="0 0 100 100"><path d="M0 8 L18 14 L26 9 L40 20 M18 14 L22 30 L14 44 M26 9 L34 0" /></svg>
          <svg className="realm-crack br" viewBox="0 0 100 100"><path d="M100 92 L82 86 L74 91 L60 80 M82 86 L78 70 L86 56 M74 91 L66 100" /></svg>
        </div>
      ) : null}
      <nav className="tabbar" aria-label="Päävalikko" style={{ gridTemplateColumns: `repeat(${LEFT.length + right.length + (show.strike ? 1 : 0)}, 1fr)` }}>
        {LEFT.map(tab)}
        {show.strike ? (
          <Link href="/kirjaa" className="tabbar-strike" aria-label="Lyö – kirjaa treeni">
            <span aria-hidden="true">⚔️</span>
            Lyö
          </Link>
        ) : null}
        {right.map(tab)}
      </nav>
    </>
  );
}
