"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HostingOffer } from "@/components/HostingOffer";

export default function HostingPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0f] px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-[14px] text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в дашборд
        </Link>

        <h1 className="font-display text-3xl tracking-tight text-zinc-50 sm:text-4xl">
          Домен и хостинг
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-zinc-400">
          Один клик — сразу нужная страница на Рег.ру. Потом скачай ZIP сайта и
          залей в хостинг.
        </p>

        <div className="mt-10">
          <HostingOffer />
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-zinc-600">
          Свой адрес вида{" "}
          <span className="text-zinc-400">имя.webcomet.ru</span> (как у Lovable)
          — отдельно, когда подключим публикацию на наших серверах. Сейчас самый
          быстрый путь: домен/хостинг на Рег.ру + ZIP.
        </p>
      </div>
    </div>
  );
}
