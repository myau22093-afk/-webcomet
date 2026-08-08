"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Подхватывает сессию из hash (#access_token=...) после подтверждения почты.
 * Supabase иногда редиректит так вместо ?code= на /auth/callback.
 */
export function AuthHashHandler({
  redirectTo = "/dashboard",
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.includes("access_token") && !hash.includes("refresh_token")) {
      return;
    }

    let cancelled = false;
    setBusy(true);

    void (async () => {
      try {
        const supabase = getSupabase();
        // Даём клиенту разобрать hash (detectSessionInUrl)
        await new Promise((r) => setTimeout(r, 50));
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !data.session) {
          // Явно достаём токены из hash, если авто-парс не сработал
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const set = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (cancelled) return;
            if (set.error || !set.data.session) {
              setBusy(false);
              return;
            }
          } else {
            setBusy(false);
            return;
          }
        }

        window.history.replaceState({}, "", window.location.pathname);
        router.replace(redirectTo);
        router.refresh();
      } catch {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  if (!busy) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 text-center text-sm text-zinc-200">
      Подтверждаем вход…
    </div>
  );
}
