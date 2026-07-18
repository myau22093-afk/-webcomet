"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { getSupabase } from "@/lib/supabaseClient";
import { getAuthErrorMessage } from "@/lib/authErrors";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(getAuthErrorMessage(error, "Ошибка входа"));
        return;
      }

      toast.success("Вход выполнен");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Ошибка входа"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wc-atmosphere flex min-h-dvh flex-1 items-center justify-center px-4 py-12 text-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8"
      >
        <BrandLogo size="sm" className="mb-6" />
        <h1 className="font-display text-2xl font-semibold">Вход</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Введите email и пароль для входа в аккаунт
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
            <label htmlFor="password" className="mb-1.5 block text-sm text-zinc-300">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="wc-input"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="wc-btn wc-btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          <Link
            href="/forgot-password"
            className="font-medium text-violet-300 hover:text-violet-200"
          >
            Забыли пароль?
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-violet-300 hover:text-violet-200">
            Зарегистрироваться
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
