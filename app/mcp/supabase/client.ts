import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseServerClient = SupabaseClient;

export function createSupabaseServerClient(): SupabaseServerClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
