import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.DISCOVERY_DB_SCHEMA ?? "fe_lab";

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!url || !key) {
    throw new Error(
      "Supabase env vars ausentes. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.",
    );
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema },
    });
  }
  return cached;
}

export const DB_SCHEMA = schema;
