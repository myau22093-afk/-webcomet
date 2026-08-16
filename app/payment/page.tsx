"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import {
  formatTokens,
  getTokenPackage,
} from "@/lib/tokenConfig";

function PaymentContent() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get("package") || searchParams.get("tier") || "pro";
  const pack = getTokenPackage(packageId) ?? getTokenPackage("pro")!;
  const [loading, setLoading] = useState(false);

  async function startPayment() {
    setLoading(true);
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch("/api/purchase-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId: pack.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ошибка");
      if (json.confirmationUrl) {
        window.location.href = json.confirmationUrl;
        return;
      }
      throw new Error("Нет ссылки на оплату");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка оплаты");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 1, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-card w-full max-w-lg p-8 text-center"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-wc-purple/40 to-wc-blue/30 text-violet-200 shadow-[0_0_30px_rgba(108,59,244,0.35)]">
        <CreditCard className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-white">
        Покупка токенов
      </h1>
      <p className="mt-2 text-zinc-400">
        Пакет <span className="text-white">{pack.label}</span> —{" "}
        {formatTokens(pack.tokens)} ток. за{" "}
        {pack.price.toLocaleString("ru-RU")} ₽
      </p>
      <p className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
        Оплата картой через защищённую форму. После оплаты токены появятся на
        балансе автоматически.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void startPayment()}
          className="wc-btn wc-btn-primary w-full py-3 text-sm disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {loading ? "Создаём платёж…" : "Перейти к оплате"}
        </button>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к пакетам
        </Link>
      </div>
    </motion.div>
  );
}

export default function PaymentPage() {
  return (
    <div className="wc-atmosphere flex min-h-dvh items-center justify-center px-4 py-12 text-white">
      <Suspense
        fallback={
          <p className="text-zinc-400">Загрузка страницы оплаты...</p>
        }
      >
        <PaymentContent />
      </Suspense>
    </div>
  );
}
