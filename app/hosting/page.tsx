"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Globe2 } from "lucide-react";
import { HostingOffer } from "@/components/HostingOffer";

export default function HostingPage() {
  return (
    <div className="wc-atmosphere min-h-dvh px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в дашборд
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400">
            <Globe2 className="h-3.5 w-3.5 text-violet-300" />
            Домен и хостинг через WebComet
          </div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-50 sm:text-4xl">
            Сайт готов — выведи его в интернет
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            Мы посредники: оформляешь домен и хостинг через нас или по партнёрским
            ссылкам — сайт оказывается онлайн, а мы получаем комиссию. Для тебя
            цены партнёров, без накрутки «ради красоты».
          </p>
        </motion.div>

        <HostingOffer />
      </div>
    </div>
  );
}
