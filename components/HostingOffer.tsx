"use client";

import Link from "next/link";
import { ExternalLink, Globe2 } from "lucide-react";
import {
  regruDomainUrl,
  regruHostingUrl,
} from "@/lib/hostingOffers";

type Props = {
  compact?: boolean;
  className?: string;
};

export function HostingOffer({ compact = false, className = "" }: Props) {
  if (compact) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}
      >
        <p className="text-[15px] font-medium text-zinc-100">
          Вывести сайт в интернет
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
          Выбери домен или хостинг — сразу откроется нужная страница.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={regruDomainUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:border-white/25"
          >
            Домен
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href={regruHostingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:border-white/25"
          >
            Хостинг
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <Link
            href="/hosting"
            className="inline-flex items-center rounded-xl px-3 py-2.5 text-[13px] text-zinc-500 hover:text-zinc-300"
          >
            Подробнее
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      <a
        href={regruDomainUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="group rounded-2xl border border-white/10 bg-black/25 p-6 transition hover:border-white/25 hover:bg-black/40"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-xl bg-white/8 p-2.5">
            <Globe2 className="h-5 w-5 text-zinc-200" />
          </span>
          <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300" />
        </div>
        <p className="mt-5 text-lg font-medium text-zinc-50">Домен</p>
        <p className="mt-1 text-[14px] leading-relaxed text-zinc-400">
          Зарегистрировать .ru или .com на Рег.ру
        </p>
        <p className="mt-4 text-[13px] text-zinc-500">от ~199 ₽/год</p>
      </a>

      <a
        href={regruHostingUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="group rounded-2xl border border-white/10 bg-black/25 p-6 transition hover:border-white/25 hover:bg-black/40"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-xl bg-white/8 p-2.5">
            <Globe2 className="h-5 w-5 text-zinc-200" />
          </span>
          <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300" />
        </div>
        <p className="mt-5 text-lg font-medium text-zinc-50">Хостинг</p>
        <p className="mt-1 text-[14px] leading-relaxed text-zinc-400">
          Хостинг и заливка ZIP — каталог тарифов Рег.ру
        </p>
        <p className="mt-4 text-[13px] text-zinc-500">от ~149 ₽/мес</p>
      </a>
    </div>
  );
}
