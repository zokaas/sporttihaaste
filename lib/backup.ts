import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { helsinkiToday } from './season';

/** Varmuuskopioon tallennettavat taulut (kaikki pelin tila; ilmoitustilaukset jäävät pois). */
export const BACKUP_TABLES = ['hits', 'step_days', 'sick_periods', 'pledge_changes', 'profiles', 'monsters', 'season', 'gate', 'sports', 'messages'];

/**
 * Tallentaa kaikki taulut yhtenä JSON-tiedostona kansioon 'backups' (migraatio 034).
 * Palauttaa tiedoston nimen. Puuttuva taulu ei kaada kopiota: virhe kirjataan tiedostoon.
 */
export async function writeBackup(supabase: SupabaseClient, label = 'auto') {
  const tables: Record<string, unknown> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select('*');
    tables[t] = error ? { error: error.message } : data;
  }
  const name = `${helsinkiToday()}-${label}-${Date.now()}.json`;
  const body = JSON.stringify({ created_at: new Date().toISOString(), tables });
  const { error } = await supabase.storage.from('backups').upload(name, new Blob([body], { type: 'application/json' }), { contentType: 'application/json' });
  if (error) throw new Error(`Varmuuskopio epäonnistui: ${error.message}. Onko migraatio 034 ajettu?`);
  return name;
}
