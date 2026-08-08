import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function publishBaseDomain(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PUBLISH_BASE_DOMAIN?.trim();
  if (fromEnv) return fromEnv.replace(/^www\./, "").toLowerCase();
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://webcomet.ru";
  try {
    return new URL(app).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "webcomet.ru";
  }
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const base = publishBaseDomain();

  // *.webcomet.ru → /s/{slug}
  if (
    host.endsWith(`.${base}`) &&
    host !== base &&
    host !== `www.${base}`
  ) {
    const slug = host.slice(0, -(base.length + 1));
    if (/^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await Promise.race([
    supabase.auth.getSession(),
    new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 8000)
    ),
  ]);

  const pathname = request.nextUrl.pathname;
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/payment");
  // /api/upload сам проверяет Bearer — не режем по cookie-сессии
  const hasBearer = Boolean(
    request.headers.get("authorization")?.match(/^Bearer\s+\S+/i)
  );

  if (!session && isProtectedPage && !hasBearer) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|hosted/).*)",
  ],
};
