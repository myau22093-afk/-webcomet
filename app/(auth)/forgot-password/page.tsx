"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { getSupabase } from "@/lib/supabaseClient";
import { getAuthErrorMessage } from "@/lib/authErrors";

const schema = z.object({
  email: z.string().email("Введите корректный email"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotForm) {
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await getSupabase().auth.resetPasswordForEmail(
        data.email,
        { redirectTo }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
      toast.success("Ссылка для сброса пароля отправлена на почту");
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Не удалось отправить письмо"));
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
        <h1 className="font-display text-2xl font-semibold">Сброс пароля</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {sent
            ? "Проверьте почту и перейдите по ссылке, чтобы задать новый пароль."
            : "Введите email — мы отправим ссылку для восстановления пароля"}
        </p>

        {!sent && (
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

            <button
              type="submit"
              disabled={loading}
              className="wc-btn wc-btn-primary w-full py-3 text-sm disabled:opacity-50"
            >
              {loading ? "Отправка..." : "Отправить ссылку"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
            Вернуться ко входу
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
