"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { getSupabase } from "@/lib/supabaseClient";
import { getAuthErrorMessage } from "@/lib/authErrors";

const schema = z
  .object({
    password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
    confirmPassword: z.string().min(6, "Подтвердите пароль"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type ResetForm = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const form = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        setReady(Boolean(data.session));
      });
  }, []);

  async function onSubmit(data: ResetForm) {
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Пароль обновлён");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Не удалось обновить пароль"));
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
        <h1 className="font-display text-2xl font-semibold">Новый пароль</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {ready
            ? "Задайте новый пароль для входа в аккаунт"
            : "Сначала перейдите по ссылке из письма, затем задайте пароль"}
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-zinc-300">
              Новый пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="wc-input"
              disabled={!ready}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm text-zinc-300"
            >
              Подтверждение пароля
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="wc-input"
              disabled={!ready}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-400">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !ready}
            className="wc-btn wc-btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {loading ? "Сохранение..." : "Сохранить пароль"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
            Войти с паролем
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
