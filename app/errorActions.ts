'use server';
import { createClient } from '@/lib/supabase/server';
import { reportError } from '@/lib/errors';

/** Selaimen kaatuminen (virherajat ja käsittelemättömät virheet) virhelokiin. Vain kirjautuneilta. */
export async function reportClientError(message: string, path: string, detail?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await reportError('Selain', String(message).slice(0, 500), { path: String(path).slice(0, 200), userId: user.id, detail: detail ? String(detail).slice(0, 2000) : null });
}
