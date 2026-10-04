// Supabase 管理端 client（server-side 專用，需 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key);
  return cached;
}

export function supabaseStatus(): { url: boolean; serviceKey: boolean } {
  return { url: !!process.env['SUPABASE_URL'], serviceKey: !!process.env['SUPABASE_SERVICE_ROLE_KEY'] };
}
