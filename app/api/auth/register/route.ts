import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authRatelimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({
  email: z.string().email(),
  /** Account secret from client — never echoed back in responses */
  secret: z.string().min(6).optional(),
  password: z.string().min(6).optional(),
});

function appOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const { success } = await authRatelimit.limit(`register:${ip}`);
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Введите корректный email и пароль (мин. 6 символов)" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const accountSecret = parsed.data.secret || parsed.data.password || "";
    if (accountSecret.length < 6) {
      return NextResponse.json(
        { error: "Введите корректный email и пароль (мин. 6 символов)" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anon) {
      return NextResponse.json(
        { error: "Auth не настроен на сервере" },
        { status: 500 }
      );
    }

    // Anon signUp — Supabase шлёт письмо подтверждения (если включено в Auth → Email)
    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const redirectTo = `${appOrigin(request)}/auth/callback?next=/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: accountSecret,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists")
      ) {
        return NextResponse.json(
          {
            error:
              "Аккаунт с таким email уже есть. Войдите или сбросьте пароль.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Supabase иногда отвечает «успехом» на повторную регистрацию без identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json(
        {
          error:
            "Аккаунт с таким email уже есть. Войдите или сбросьте пароль.",
        },
        { status: 409 }
      );
    }

    const needsEmailConfirmation = !data.session;

    return NextResponse.json({
      ok: true,
      email,
      needsEmailConfirmation,
    });
  } catch (error) {
    console.error("register API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
