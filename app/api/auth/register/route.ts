import { NextResponse } from "next/server";
import { z } from "zod";
import { authRatelimit, clientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { FREE_TOKENS } from "@/lib/tokenConfig";

const bodySchema = z.object({
  email: z.string().email(),
  /** Account secret from client — never echoed back in responses */
  secret: z.string().min(6).optional(),
  password: z.string().min(6).optional(),
});

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

    const email = parsed.data.email;
    const accountSecret = parsed.data.secret || parsed.data.password || "";
    if (accountSecret.length < 6) {
      return NextResponse.json(
        { error: "Введите корректный email и пароль (мин. 6 символов)" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: accountSecret,
      email_confirm: true,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
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

    if (!data.user) {
      return NextResponse.json(
        { error: "Не удалось создать аккаунт" },
        { status: 500 }
      );
    }

    await admin.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        tier: "starter",
        token_balance: FREE_TOKENS,
        total_tokens_used: 0,
        free_tokens_claimed: true,
        subscription_status: "trial",
      },
      { onConflict: "id" }
    );

    try {
      await admin.from("transactions").insert({
        user_id: data.user.id,
        amount: 0,
        tokens: FREE_TOKENS,
        type: "bonus",
        description: "Бесплатные токены при регистрации",
      });
    } catch {
      /* таблица может ещё не существовать */
    }

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("register API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
