import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabaseCookie";

let client: SupabaseClient | undefined;
let authReady: Promise<void> = Promise.resolve();

const SESSION_BACKUP_KEY = "wc-auth-backup-v1";

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

type SessionBackup = {
  access_token: string;
  refresh_token: string;
};

function readBackup(): SessionBackup | null {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionBackup;
    if (!data?.access_token || !data?.refresh_token) return null;
    return data;
  } catch {
    return null;
  }
}

function writeBackup(session: Session | null) {
  try {
    if (!session?.access_token || !session?.refresh_token) {
      localStorage.removeItem(SESSION_BACKUP_KEY);
      return;
    }
    localStorage.setItem(
      SESSION_BACKUP_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    );
  } catch {
    /* private mode */
  }
}

async function recoverSession(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  if (data.session?.refresh_token) {
    writeBackup(data.session);
    return;
  }

  const backup = readBackup();
  if (!backup) return;

  const restored = await supabase.auth.setSession({
    access_token: backup.access_token,
    refresh_token: backup.refresh_token,
  });
  if (restored.data.session) {
    writeBackup(restored.data.session);
    return;
  }

  const refreshed = await supabase.auth.refreshSession({
    refresh_token: backup.refresh_token,
  });
  if (refreshed.data.session) {
    writeBackup(refreshed.data.session);
    return;
  }

  writeBackup(null);
}

export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getSupabase() {
  if (!client) {
    client = createClient();
    if (typeof window !== "undefined") {
      authReady = recoverSession(client);
      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          writeBackup(null);
          return;
        }
        if (session) writeBackup(session);
      });
    }
  }
  return client;
}

/** Дождаться восстановления сессии из cookie / backup. */
export function whenAuthReady() {
  getSupabase();
  return authReady;
}
