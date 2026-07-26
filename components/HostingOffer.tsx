"use client";

import Link from "next/link";
import { ExternalLink, Globe2, Server } from "lucide-react";
import {
  getHostingPartners,
  HOSTING_ASSIST_PACKAGES,
} from "@/lib/hostingOffers";

type Props = {
  /** Компактный блок (после ZIP / в мастере) */
  compact?: boolean;
  className?: string;
};

export function HostingOffer({ compact = false, className = "" }: Props) {
  const partners = getHostingPartners();

  if (compact) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-transparent to-sky-500/5 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-white/10 p-2">
            <Globe2 className="h-4 w-4 text-violet-200" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              Нужны домен и хостинг?
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Оформи через нас — поможем с доменом, хостингом и заливкой сайта.
              Мы получаем комиссию, для тебя цена как у партнёра.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/hosting"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/25 px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-500/35"
              >
                <Server className="h-3.5 w-3.5" />
                Выбрать пакет
              </Link>
              {partners.slice(0, 2).map((p) => (
                <a
                  key={p.id}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/12 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:bg-white/5"
                >
                  {p.name}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        {HOSTING_ASSIST_PACKAGES.map((pack) => (
          <div
            key={pack.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]"
          >
            <p className="text-sm font-medium text-zinc-100">{pack.title}</p>
            <p className="mt-1 text-lg text-violet-200">{pack.priceLabel}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
              {pack.description}
            </p>
            <a
              href={`mailto:support@webcomet.app?subject=${encodeURIComponent(
                `Заявка: ${pack.title}`
              )}&body=${encodeURIComponent(
                `Здравствуйте! Хочу оформить пакет «${pack.title}» через WebComet.`
              )}`}
              className="mt-4 inline-flex rounded-xl bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/30"
            >
              Оставить заявку
            </a>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Или сразу у партнёра
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {partners.map((p) => (
            <a
              key={p.id}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/25"
            >
              <span>
                <span className="block text-sm text-zinc-100">{p.name}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  {p.blurb}
                </span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-300" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
