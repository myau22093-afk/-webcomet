"use client";

import { useEffect } from "react";
import { getSupabase, whenAuthReady } from "@/lib/supabaseClient";

/**
 * На телефоне JS замирает в фоне — refresh токена не крутится.
 * Когда вкладка снова видна, принудительно обновляем сессию.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    const supabase = getSupabase();
    void whenAuthReady();

    function wake() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void supabase.auth.startAutoRefresh();
      void supabase.auth.refreshSession();
    }

    function sleep() {
      supabase.auth.stopAutoRefresh();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") wake();
      else sleep();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, []);

  return null;
}
