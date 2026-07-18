import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    // Во время Docker build переменных может не быть — не роняем сборку
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return {
        url: "https://placeholder.supabase.co",
        key: "placeholder",
      };
    }
    throw new Error(
      "Supabase не настроен: заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY"
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
