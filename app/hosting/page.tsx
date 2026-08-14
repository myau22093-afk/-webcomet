"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { HostingOffer } from "@/components/HostingOffer";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { getSupabase, whenAuthReady } from "@/lib/supabaseClient";

export default function HostingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    void whenAuthReady().then(() =>
      supabase.auth.getSession().then(({ data: { session } }) => {
        setLoggedIn(Boolean(session));
      })
    );
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setLoggedIn(false);
        return;
      }
      if (session) setLoggedIn(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="wc-landing wc-inner-page relative text-white">
      <SiteHeader loggedIn={loggedIn} />
      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl tracking-tight text-zinc-50 sm:text-4xl">
          Вывести сайт в интернет
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-zinc-400">
          Опубликовать на WebComet или взять свой домен.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-500/20 p-2.5">
              <Rocket className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-[16px] font-medium text-emerald-50">
                На WebComet
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-emerald-100/70">
                В студии — «Опубликовать». Ссылка вида m-516.webcomet.ru, от 199
                ₽/мес.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex rounded-xl bg-emerald-500/25 px-4 py-2.5 text-[13px] font-medium text-emerald-50 hover:bg-emerald-500/35"
              >
                Создать сайт
              </Link>
            </div>
          </div>
        </div>

        <p className="mb-3 mt-10 text-[12px] font-medium uppercase tracking-wider text-zinc-500">
          Свой домен
        </p>
        <HostingOffer />
      </main>
      <SiteFooter loggedIn={loggedIn} />
    </div>
  );
}
