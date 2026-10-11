import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Palvelinpuolen pääsy ohi RLS:n (vain Vercelin ympäristömuuttujasta). Ilman avainta null. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
