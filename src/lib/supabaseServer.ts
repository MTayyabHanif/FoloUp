import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service-role key. Bypasses RLS;
 * use only in server routes that perform their own auth checks.
 *
 * Lazy singleton — created on first call so route bundles that never need
 * the service-role key never instantiate it.
 */
let serviceRoleClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service-role env vars missing (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  serviceRoleClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return serviceRoleClient;
}
