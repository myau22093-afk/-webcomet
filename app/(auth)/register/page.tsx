"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { getAuthErrorMessage } from "@/lib/authErrors";

const registerSchema = z
  .object({
    email: z.string().email("Введите корректный email"),
    passphrase: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
    confirmPassphrase: z.string().min(6, "Подтвердите пароль"),
  })
  .refine((data) => data.passphrase === data.confirmPassphrase, {
    message: "Пароли не совпадают",
    path: ["confirmPassphrase"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="wc-atmosphere flex min-h-dvh flex-1 items-center justify-center px-4 py-12 text-white">
          <p className="text-zinc-400">Загрузка…</p>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", passphrase: "", confirmPassphrase: "" },
  });

  async function onSubmit(data: RegisterForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          secret: data.passphrase,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        ok?: boolean;
        email?: string;
        needsEmailConfirmation?: boolean;
      };

      if (!res.ok) {
        toast.error(payload.error ?? "Ошибка регистрации");
        return;
      }

      if (payload.needsEmailConfirmation !== false) {
        setPendingEmail(payload.email ?? data.email);
        toast.success("Письмо отправлено — подтвердите email");
        return;
      }

      // На случай если в Supabase отключено Confirm email
      toast.success("Регистрация успешна");
      window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(payload.error ?? "Не удалось отправить письмо");
        return;
      }
      toast.success("Письмо отправлено ещё раз");
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Не удалось отправить письмо"));
    } finally {
      setResending(false);
    }
  }

  if (pendingEmail) {
    return (
      <div className="wc-atmosphere flex min-h-dvh flex-1 items-center justify-center px-4 py-12 text-white">
        <motion.div
          initial={{ opacity: 1, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card w-full max-w-md p-8"
        >
          <BrandLogo size="sm" className="mb-6" />
          <h1 className="font-display text-2xl font-semibold">
            Подтвердите email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Мы отправили ссылку на{" "}
            <span className="font-medium text-zinc-200">{pendingEmail}</span>.
            Откройте письмо и нажмите кнопку подтверждения — после этого можно
            войти.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Письма нет? Проверьте «Спам» и «Промоакции».
          </p>
          <button
            type="button"
            disabled={resending}
            onClick={() => void resendConfirmation()}
            className="wc-btn wc-btn-primary mt-8 w-full py-3 text-sm disabled:opacity-50"
          >
            {resending ? "Отправляем…" : "Отправить письмо ещё раз"}
          </button>
          <p className="mt-6 text-center text-sm text-zinc-500">
            Уже подтвердили?{" "}
            <Link
              href="/login"
              className="font-medium text-violet-300 hover:text-violet-200"
            >
              Войти
            </Link>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="wc-atmosphere flex min-h-dvh flex-1 items-center justify-center px-4 py-12 text-white">
      <motion.div
        initial={{ opacity: 1, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card w-full max-w-md p-8"
      >
        <BrandLogo size="sm" className="mb-6" />
        <h1 className="font-display text-2xl font-semibold">Регистрация</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Укажите реальный email — на него придёт ссылка подтверждения
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="wc-input"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="passphrase" className="mb-1.5 block text-sm text-zinc-300">
              Пароль
            </label>
            <input
              id="passphrase"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="wc-input"
              {...form.register("passphrase")}
            />
            {form.formState.errors.passphrase && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.passphrase.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassphrase"
              className="mb-1.5 block text-sm text-zinc-300"
            >
              Подтверждение пароля
            </label>
            <input
              id="confirmPassphrase"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="wc-input"
              {...form.register("confirmPassphrase")}
            />
            {form.formState.errors.confirmPassphrase && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.confirmPassphrase.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="wc-btn wc-btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
            Войти
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
