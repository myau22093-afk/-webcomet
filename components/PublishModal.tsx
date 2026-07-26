"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Rocket, X } from "lucide-react";
import {
  PUBLISH_PACKAGES,
  publishBaseDomain,
  publishPathUrl,
  publishPublicUrl,
  type PublishPackageId,
} from "@/lib/publishConfig";
import { regruDomainUrl, regruHostingUrl } from "@/lib/hostingOffers";

type Props = {
  open: boolean;
  onClose: () => void;
  getAccessToken: () => Promise<string | null>;
  site: {
    id?: string | null;
    html: string;
    css: string;
    js: string;
    title?: string;
  };
};

export function PublishModal({ open, onClose, getAccessToken, site }: Props) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [previewSlug] = useState(
    () => `m-${Math.floor(100 + Math.random() * 900)}xxxx`
  );
  const base = publishBaseDomain();

  if (!open) return null;

  async function buy(packageId: PublishPackageId) {
    setError("");
    setBuying(packageId);
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch("/api/purchase-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageId,
          siteId: site.id || undefined,
          html: site.html,
          css: site.css,
          js: site.js,
          title: site.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка оплаты");
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl as string;
        return;
      }
      throw new Error("Нет ссылки на оплату");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-zinc-100">
          <Rocket className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-medium">Опубликовать сайт</h2>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
          Сайт будет доступен по ссылке вида{" "}
          <span className="text-violet-300">
            {previewSlug}.{base}
          </span>
          . Можно сразу кинуть в соцсети или рекламу. Выбери срок — продлить
          можно позже.
        </p>

        <div className="mt-5 space-y-2">
          {PUBLISH_PACKAGES.map((pack) => (
            <button
              key={pack.id}
              type="button"
              disabled={Boolean(buying)}
              onClick={() => void buy(pack.id)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10 disabled:opacity-50"
            >
              <span className="text-[15px] text-zinc-100">{pack.label}</span>
              <span className="inline-flex items-center gap-2 text-[15px] text-violet-300">
                {buying === pack.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {pack.price.toLocaleString("ru-RU")} ₽
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 text-[13px] text-rose-300">{error}</p>
        ) : null}

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-[12px] text-zinc-500">
            Нужен свой домен? Закажи на Рег.ру и залей ZIP.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={regruDomainUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200"
            >
              Домен <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={regruHostingUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200"
            >
              Хостинг <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="mt-3 text-[11px] text-zinc-600">
            Пока DNS не настроен, сайт также откроется как{" "}
            {publishPathUrl("ваш-код")} · после оплаты покажем точную ссылку.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PublishSuccessBanner({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const sub = publishPublicUrl(slug);
  const path = publishPathUrl(slug);
  return (
    <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-medium text-emerald-100">
            Сайт опубликован
          </p>
          <p className="mt-1 text-[13px] text-emerald-200/80">
            <a href={path} target="_blank" rel="noopener noreferrer" className="underline">
              {path}
            </a>
            <span className="mx-2 text-emerald-200/40">·</span>
            <a href={sub} target="_blank" rel="noopener noreferrer" className="underline">
              {sub}
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[12px] text-emerald-200/70 hover:bg-white/5"
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
