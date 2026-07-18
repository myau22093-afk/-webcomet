import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase не настроен: заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local"
    );
  }

  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}

export function getSupabase() {
  if (!client) {
    client = createClient();
  }
  return client;
}
