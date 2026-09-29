import type { Metadata, Viewport } from 'next';
import { Grenze_Gotisch, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { testDay } from '@/lib/today';
import { formatDay } from '@/lib/season';
import ScrollMemory from '@/components/ScrollMemory';
import StrikeToastHost from '@/components/StrikeToastHost';
import LiveStrikes from '@/components/LiveStrikes';
import ResumeRefresh from '@/components/ResumeRefresh';
import BootSplash from '@/components/BootSplash';

const display = Grenze_Gotisch({ subsets: ['latin', 'latin-ext'], weight: ['500', '700'], variable: '--font-display' });
const body = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-body' });

// iPhonen kotinäytön sovelluksen käynnistyskuvat (silmät + nimi mustalla), ettei käynnistyksessä näy pelkkää mustaa.
// Luotu kerran kuvakaappauksina; iOS valitsee laitteen koon mukaan.
const SPLASH = [
    { url: '/splash/splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1242x2688.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    { url: '/splash/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    { url: '/splash/splash-1320x2868.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1206x2622.png', media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-1080x2340.png', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    { url: '/splash/splash-640x1136.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
];

export const metadata: Metadata = {
  title: 'Monsterijahti',
  description: 'Ystävyyden voimalla yhtätoista monsteria ja loppupomoa vastaan.',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }], apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'Monsterijahti', statusBarStyle: 'black-translucent', startupImage: SPLASH },
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
        {/* Tumma tausta heti ennen tyylitiedoston latautumista: ei valkoista välähdystä käynnistyksessä. */}
        <meta name="color-scheme" content="dark" />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#0E0C0B;color-scheme:dark}' }} />
      </head>
      <body>
        <BootSplash />
        {testDay() ? <div className="test-banner">Testitila: {formatDay(testDay()!)} · <a href="/yllapito">lopeta</a></div> : null}
        <main className="app">{children}</main>
        <ScrollMemory />
        <StrikeToastHost />
        <LiveStrikes />
        <ResumeRefresh />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}",
          }}
        />
      </body>
    </html>
  );
}
