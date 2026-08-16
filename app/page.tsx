"use client";

import { useEffect, useState } from "react";
import { LandingChat } from "@/components/landing/LandingChat";
import { getSupabase, whenAuthReady } from "@/lib/supabaseClient";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  function syncSession() {
    return getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setLoggedIn(Boolean(session));
        setUserEmail(session?.user?.email ?? null);
        setReady(true);
      });
  }

  useEffect(() => {
    void whenAuthReady().then(() => syncSession());

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setUserEmail(session?.user?.email ?? null);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="wc-lovable flex min-h-dvh items-center justify-center text-zinc-500">
        <p className="relative z-10 text-sm">Загрузка…</p>
      </div>
    );
  }

  return (
    <LandingChat
      loggedIn={loggedIn}
      userEmail={userEmail}
      onAuthSuccess={() => {
        void syncSession();
      }}
    />
  );
}
