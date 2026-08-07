import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authRatelimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({
  email: z.string().email(),
});

function appOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const { success } = await authRatelimit.limit(`resend-confirm:${ip}`);
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Введите корректный email" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anon) {
      return NextResponse.json(
        { error: "Auth не настроен на сервере" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${appOrigin(request)}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("resend-confirmation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка отправки" },
      { status: 500 }
    );
  }
}
