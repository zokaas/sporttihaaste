import type { Metadata, Viewport } from 'next';
import { Grenze_Gotisch, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const display = Grenze_Gotisch({ subsets: ['latin', 'latin-ext'], weight: ['500', '700'], variable: '--font-display' });
const body = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Monsterijahti',
  description: 'Ystävyyden voimalla kymmentä monsteria ja loppupomoa vastaan.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Monsterijahti', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0E0C0B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={`${display.variable} ${body.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <main className="app">{children}</main>
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}",
          }}
        />
      </body>
    </html>
  );
}
