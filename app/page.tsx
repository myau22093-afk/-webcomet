"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { GenerationCinema } from "@/components/landing/GenerationCinema";
import { ShowcaseStrip } from "@/components/landing/ShowcaseStrip";
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

  const primaryHref = loggedIn ? "/dashboard" : "/register";
  const primaryLabel = loggedIn ? "Открыть Студию" : "Попробовать бесплатно";

  return (
    <div className="wc-landing relative min-h-dvh overflow-x-hidden text-white">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
      />

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

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo size="md" />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/pricing"
            className="wc-btn wc-btn-ghost hidden px-4 py-2 text-sm text-zinc-300 sm:inline-flex"
          >
            Тарифы
          </Link>
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="wc-btn wc-btn-glow px-4 py-2 text-sm"
            >
              Дашборд
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="wc-btn wc-btn-ghost px-4 py-2 text-sm text-zinc-300"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="wc-btn wc-btn-glow px-4 py-2 text-sm"
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10">
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
                href={primaryHref}
                className="wc-btn wc-btn-glow min-h-12 px-8 text-base"
              >
                {primaryLabel}
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

        <div id="showcase" className="wc-landing-below">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <ShowcaseStrip loggedIn={loggedIn} />
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <BrandLogo size="sm" />
            <p className="mt-2 text-sm text-zinc-500">
              support@webcomet.app · AI-платформа генерации
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <Link href="/pricing" className="hover:text-white">
              Тарифы
            </Link>
            <Link href="/requisites" className="hover:text-white">
              Реквизиты
            </Link>
            {loggedIn ? (
              <Link href="/dashboard" className="hover:text-white">
                Дашборд
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:text-white">
                  Вход
                </Link>
                <Link href="/register" className="hover:text-white">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
