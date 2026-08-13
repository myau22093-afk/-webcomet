"use client";

import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
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
          Вывести сайт в интернет
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-zinc-400">
          Два пути: сразу опубликовать на WebComet или взять свой домен на
          Рег.ру.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-500/20 p-2.5">
              <Rocket className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-[16px] font-medium text-emerald-50">
                Одним кликом на WebComet
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-emerald-100/70">
                В дашборде нажми «Опубликовать» у готового сайта — получишь ссылку
                вида{" "}
                <span className="text-emerald-200">m-516.webcomet.ru</span> и
                выберешь срок (от 199 ₽/мес).
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
          Свой домен на Рег.ру
        </p>
        <HostingOffer />
      </div>
    </div>
  );
}
