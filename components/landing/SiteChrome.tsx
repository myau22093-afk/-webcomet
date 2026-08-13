"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

type Props = {
  loggedIn?: boolean;
};

export function SiteHeader({ loggedIn = false }: Props) {
  return (
    <header className="wc-landing-header relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between">
      <BrandLogo size="sm" className="wc-landing-logo" />
      <nav className="wc-landing-nav">
        <Link
          href="/pricing"
          className="wc-btn wc-btn-ghost hidden px-4 py-2 text-sm text-zinc-300 md:inline-flex"
        >
          Тарифы
        </Link>
        {loggedIn ? (
          <Link
            href="/dashboard"
            className="wc-btn wc-btn-glow wc-landing-nav-cta"
          >
            Дашборд
          </Link>
        ) : (
          <>
            <Link href="/login" className="wc-landing-nav-link">
              Войти
            </Link>
            <Link
              href="/register"
              className="wc-btn wc-btn-glow wc-landing-nav-cta"
            >
              Регистрация
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter({ loggedIn = false }: Props) {
  return (
    <footer className="wc-landing-footer relative z-10 border-t border-white/10 bg-black/50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <BrandLogo size="sm" />
          <p className="mt-2 text-sm text-zinc-500">
            Техподдержка:{" "}
            <a href={SUPPORT_MAILTO} className="text-zinc-400 hover:text-white">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link href="/pricing" className="hover:text-white">
            Тарифы
          </Link>
          <Link href="/hosting" className="hover:text-white">
            Хостинг
          </Link>
          <Link href="/requisites" className="hover:text-white">
            Реквизиты
          </Link>
          <a href={SUPPORT_MAILTO} className="hover:text-white">
            Поддержка
          </a>
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
  );
}
