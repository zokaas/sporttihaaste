import Link from 'next/link';

const LINKS = [
  { href: '/', label: 'Taistelu' },
  { href: '/mina', label: 'Minä' },
  { href: '/sankarit', label: 'Sankarit' },
  { href: '/bestiaario', label: 'Bestiaario' },
];

export default function Nav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Päävalikko">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}>{l.label}</Link>
      ))}
      <Link href="/saannot" className="help" aria-label="Säännöt" aria-current={current === '/saannot' ? 'page' : undefined}>?</Link>
    </nav>
  );
}
