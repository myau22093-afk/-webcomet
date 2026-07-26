"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { getSupabase } from "@/lib/supabaseClient";

const features = [
  {
    title: "Скорость",
    text: "Лендинг за пару минут: идея, стиль, превью — без дизайнера и верстальщика.",
  },
  {
    title: "Качество",
    text: "Секции, типографика и анимации на уровне студийных сайтов.",
  },
  {
    title: "Цена",
    text: "Старт бесплатно. Платите токенами только за генерации.",
  },
];

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
  const primaryLabel = loggedIn ? "Открыть дашборд" : "Попробовать бесплатно";

  return (
    <div className="wc-landing relative min-h-dvh overflow-hidden text-white">
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
        <BrandLogo size="lg" />
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

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <motion.section
          initial={{ opacity: 1, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
            Создай свой сайт за 5 минут
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-200 sm:text-lg">
            Опиши идею — WebComet соберёт лендинг, сгенерирует картинки и
            поможет в чате. Код и живое превью сразу.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="wc-btn wc-btn-glow min-h-12 w-full px-8 text-base sm:w-auto"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!loggedIn && (
              <Link
                href="/pricing"
                className="text-sm text-zinc-400 underline-offset-4 transition hover:text-white hover:underline"
              >
                Смотреть тарифы
              </Link>
            )}
          </div>
        </motion.section>

        <section className="wc-stagger mt-16 grid gap-4 sm:mt-20 sm:grid-cols-3 sm:gap-5">
          {features.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/12 bg-[#0a0b12]/80 p-5 sm:p-6"
            >
              <span className="wc-feature-streak" aria-hidden />
              <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {item.text}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/35 backdrop-blur-md">
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
