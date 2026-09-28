import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    return await refreshSession(request);
  } catch (error) {
    // Sivut ja API tarkistavat kirjautumisen itse, joten virhe ei saa kaataa koko sivustoa.
    console.error('middleware: Supabase-istunnon päivitys epäonnistui', error);
    return NextResponse.next({ request });
  }
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getSession lukee istunnon evästeestä eikä tee verkkokutsua (paitsi vanhentuneen tokenin uusimiseksi).
  // Tässä se riittää ohjaukseen; sivut ja toiminnot tarkistavat käyttäjän aina Supabasesta (getUser).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const path = request.nextUrl.pathname;
  // Ajastettu muistutus kutsuu ilman kirjautumista; reitti tarkistaa oman salaisuutensa (CRON_SECRET).
  const open = path.startsWith('/kirjaudu') || path.startsWith('/auth') || path.startsWith('/api/cron/');
  if (!user && !open) {
    const url = request.nextUrl.clone();
    url.pathname = '/kirjaudu';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)'],
};
