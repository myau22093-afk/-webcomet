"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabaseClient";
import { getAuthErrorMessage, withAuthTimeout } from "@/lib/authErrors";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

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

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type Tab = "login" | "register";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Вызывается после успешного входа/регистрации без ухода со страницы */
  onSuccess: () => void;
  initialTab?: Tab;
};

export function InlineAuthModal({
  open,
  onClose,
  onSuccess,
  initialTab = "register",
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setPendingEmail(null);
      setNeedsConfirm(false);
    }
  }, [open, initialTab]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", passphrase: "", confirmPassphrase: "" },
  });

  if (!open) return null;

  async function onLogin(data: LoginForm) {
    setLoading(true);
    setNeedsConfirm(false);
    try {
      const { error } = await withAuthTimeout(
        getSupabase().auth.signInWithPassword({
          email: data.email.trim(),
          password: data.password,
        }),
        20000
      );
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed")) setNeedsConfirm(true);
        toast.error(getAuthErrorMessage(error, "Ошибка входа"));
        return;
      }
      toast.success("Вход выполнен");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Ошибка входа"));
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(data: RegisterForm) {
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
        toast.success("Письмо отправлено. Подтвердите email");
        return;
      }
      // Confirm email выключен — сразу логиним
      const { error } = await withAuthTimeout(
        getSupabase().auth.signInWithPassword({
          email: data.email.trim(),
          password: data.passphrase,
        }),
        20000
      );
      if (error) {
        toast.success("Регистрация успешна. Теперь войдите");
        setTab("login");
        loginForm.setValue("email", data.email);
        return;
      }
      toast.success("Регистрация успешна");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation(email: string) {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(payload.error ?? "Не удалось отправить письмо");
        return;
      }
      toast.success("Письмо отправлено");
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Не удалось отправить письмо"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/12 bg-[#101222] p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        {pendingEmail ? (
          <>
            <h2 className="pr-8 font-display text-xl font-semibold text-white">
              Подтвердите email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Ссылка отправлена на{" "}
              <span className="font-medium text-zinc-200">{pendingEmail}</span>.
              После подтверждения войдите. Чат уже сохранён.
            </p>
            <button
              type="button"
              disabled={resending}
              onClick={() => void resendConfirmation(pendingEmail)}
              className="wc-lovable-btn-dark mt-5 w-full justify-center py-3 disabled:opacity-50"
            >
              {resending ? "Отправляем…" : "Отправить ещё раз"}
            </button>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-violet-300 hover:text-violet-200"
              onClick={() => {
                setPendingEmail(null);
                setTab("login");
              }}
            >
              Уже подтвердил? Войти
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  tab === "register"
                    ? "bg-white/12 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                onClick={() => setTab("register")}
              >
                Регистрация
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  tab === "login"
                    ? "bg-white/12 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                onClick={() => setTab("login")}
              >
                Войти
              </button>
            </div>

            <h2 className="pr-8 font-display text-xl font-semibold text-white">
              {tab === "register" ? "Создать аккаунт" : "Войти"}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Диалог уже сохранён, никуда уходить не нужно.
            </p>

            {tab === "login" ? (
              <form
                onSubmit={loginForm.handleSubmit(onLogin)}
                className="mt-5 space-y-3"
              >
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  className="wc-inline-auth-input"
                  {...loginForm.register("email")}
                />
                {loginForm.formState.errors.email ? (
                  <p className="text-xs text-rose-300">
                    {loginForm.formState.errors.email.message}
                  </p>
                ) : null}
                <input
                  type="password"
                  placeholder="Пароль"
                  autoComplete="current-password"
                  className="wc-inline-auth-input"
                  {...loginForm.register("password")}
                />
                {loginForm.formState.errors.password ? (
                  <p className="text-xs text-rose-300">
                    {loginForm.formState.errors.password.message}
                  </p>
                ) : null}
                {needsConfirm ? (
                  <button
                    type="button"
                    disabled={resending}
                    className="text-xs text-violet-300 hover:text-violet-200"
                    onClick={() =>
                      void resendConfirmation(loginForm.getValues("email"))
                    }
                  >
                    Отправить письмо подтверждения снова
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="wc-lovable-btn-dark w-full justify-center py-3 disabled:opacity-50"
                >
                  {loading ? "Входим…" : "Войти"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={registerForm.handleSubmit(onRegister)}
                className="mt-5 space-y-3"
              >
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  className="wc-inline-auth-input"
                  {...registerForm.register("email")}
                />
                {registerForm.formState.errors.email ? (
                  <p className="text-xs text-rose-300">
                    {registerForm.formState.errors.email.message}
                  </p>
                ) : null}
                <input
                  type="password"
                  placeholder="Пароль"
                  autoComplete="new-password"
                  className="wc-inline-auth-input"
                  {...registerForm.register("passphrase")}
                />
                {registerForm.formState.errors.passphrase ? (
                  <p className="text-xs text-rose-300">
                    {registerForm.formState.errors.passphrase.message}
                  </p>
                ) : null}
                <input
                  type="password"
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  className="wc-inline-auth-input"
                  {...registerForm.register("confirmPassphrase")}
                />
                {registerForm.formState.errors.confirmPassphrase ? (
                  <p className="text-xs text-rose-300">
                    {registerForm.formState.errors.confirmPassphrase.message}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="wc-lovable-btn-dark w-full justify-center py-3 disabled:opacity-50"
                >
                  {loading ? "Создаём…" : "Зарегистрироваться"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
