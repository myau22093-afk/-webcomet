import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { publicAppOrigin } from "@/lib/appOrigin";
import { getOrCreateBillingProfile } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const origin = publicAppOrigin(request);
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // Нет ?code= — возможно hash-токены в браузере. Нельзя 302 на /login
  // (hash пропадёт). Отдаём страницу, которая сохранит # и уйдёт на /login.
  if (!code && !token_hash) {
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Вход…</title></head><body style="margin:0;background:#0a0a0f;color:#e4e4e7;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center"><p>Подтверждаем вход…</p><script>
(function(){
  var h=location.hash||"";
  if(h.indexOf("access_token")!==-1||h.indexOf("refresh_token")!==-1){
    location.replace(${JSON.stringify(`${origin}/login`)}+h);
  }else{
    location.replace(${JSON.stringify(`${origin}/login`)});
  }
})();
</script></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  let error: { message: string } | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (token_hash && type) {
    const result = await supabase.auth.verifyOtp({ type, token_hash });
    error = result.error;
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await getOrCreateBillingProfile(createAdminClient(), {
        id: user.id,
        email: user.email,
      });
    }
  } catch (e) {
    console.error("auth callback profile:", e);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
