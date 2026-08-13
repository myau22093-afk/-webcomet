"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GenerationCinema } from "@/components/landing/GenerationCinema";
import { ShowcaseStrip } from "@/components/landing/ShowcaseStrip";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { getSupabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(Boolean(session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="wc-landing relative text-white">
      <div className="wc-hero-stage" aria-hidden>
        <picture>
          <source srcSet="/hero-bg.webp?v=4" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-bg.jpg?v=4"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
            className="wc-hero-bg"
          />
        </picture>
        <div className="wc-hero-bloom" />
        <div className="wc-hero-overlay" />
        <div className="wc-hero-vignette" />
      </div>

      <SiteHeader loggedIn={loggedIn} />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <section className="wc-hero-compose mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8">
          <motion.div
            className="wc-hero-copy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="wc-hero-brand" aria-label="WebComet.ru">
              <span className="wc-brand-web">Web</span>
              <span className="wc-brand-comet">Comet</span>
              <span className="wc-brand-tld">.ru</span>
            </p>
            <h1 className="wc-hero-headline">
              Сайт собирается
              <br />
              на ваших глазах
            </h1>
            <p className="wc-hero-lead">
              Опиши идею или выбери пример ниже — ИИ соберёт лендинг, картинки и
              правки в чате.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="wc-btn wc-btn-glow min-h-12 px-8 text-base"
              >
                Создать сайт
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#showcase"
                className="text-center text-sm text-zinc-400 underline-offset-4 transition hover:text-white hover:underline sm:text-left"
              >
                Смотреть примеры
              </a>
            </div>
          </motion.div>

          <motion.div
            className="wc-hero-cinema-wrap"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <GenerationCinema />
          </motion.div>
        </section>

        <div id="showcase" className="wc-landing-below flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <ShowcaseStrip loggedIn={loggedIn} />
          </div>
        </div>
      </main>

      <SiteFooter loggedIn={loggedIn} />
    </div>
  );
}
