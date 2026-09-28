import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * Kuvat kulkevat Nextin kuvaoptimoinnin kautta: puhelin saa pienennetyn WebP/AVIF-kuvan
 * alkuperäisen (usein monen megatavun) tiedoston sijaan. Leveyden pitää olla Nextin sallituissa kooissa.
 */
function optimized(url: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}

export function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  return optimized(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`, 128);
}

export function monsterImageUrl(path: string | null | undefined) {
  if (!path) return null;
  return optimized(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/monsters/${path}`, 828);
}
