import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** true si la base Supabase est configurée (sinon on retombe sur le stockage fichier). */
export function hasSupabase(): boolean {
  return !!(url && serviceKey);
}

let client: SupabaseClient | null = null;

/** Client Supabase côté serveur (service role — contourne la RLS). Jamais exposé au client. */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
