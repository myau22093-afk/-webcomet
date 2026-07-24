"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import {
  FREE_TOKENS,
  TOKEN_PACKAGES,
  formatTokens,
} from "@/lib/tokenConfig";

export default function PricingPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) return;
        setEmail(session.user.email ?? null);
        const res = await fetch("/api/user/balance", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok) setBalance(data.token_balance ?? 0);
      });
  }, []);

  async function buy(packageId: string) {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setBuying(packageId);
    try {
      const res = await fetch("/api/purchase-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ошибка");
      if (json.confirmationUrl) {
        window.location.href = json.confirmationUrl;
        return;
      }
      throw new Error("Нет ссылки на оплату");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка покупки");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="wc-atmosphere min-h-dvh px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в дашборд
        </Link>

        <motion.div
          initial={{ opacity: 1, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-wc-purple/25 text-violet-200 shadow-[0_0_30px_rgba(108,59,244,0.35)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            Токены WebComet
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
            Платите только за запросы. После регистрации — {FREE_TOKENS}{" "}
            бесплатных токенов. Стоимость зависит от типа задачи: создание сайта,
            правка или чат.
            {balance != null && email && (
              <>
                {" "}
                Ваш баланс:{" "}
                <span className="text-violet-200">
                  {formatTokens(balance)} ток.
                </span>
              </>
            )}
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TOKEN_PACKAGES.map((pack, index) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.35 }}
              className={`glass-card flex flex-col p-6 ${
                pack.id === "pro" ? "ring-1 ring-violet-500/40" : ""
              }`}
            >
              <p className="text-sm text-zinc-400">{pack.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatTokens(pack.tokens)}
              </p>
              <p className="text-sm text-zinc-500">токенов</p>
              <p className="mt-4 text-xl text-violet-200">
                {pack.price.toLocaleString("ru-RU")} ₽
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  Без срока действия
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  Сайт, картинки и чат
                </li>
              </ul>
              <button
                type="button"
                disabled={buying === pack.id}
                onClick={() => void buy(pack.id)}
                className="wc-btn wc-btn-primary mt-6 w-full py-2.5 text-sm disabled:opacity-50"
              >
                {buying === pack.id ? "Открываем…" : "Купить"}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
