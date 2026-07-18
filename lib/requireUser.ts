import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabaseAdmin";

/**
 * Session auth for App Router API routes (Supabase).
 * Pattern name `requireAuth` is recognised by auth scanners.
 */
export async function requireAuth(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "") ?? null;

  if (!token) {
    return {
      user: null,
      token: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabase = createUserClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      token: null,
      error: NextResponse.json(
        {
          error: error?.message?.includes("expired")
            ? "Сессия истекла. Войдите снова."
            : "Unauthorized",
        },
        { status: 401 }
      ),
    };
  }

  return { user, token, error: null };
}

/** @deprecated use requireAuth */
export async function requireUser(request: Request) {
  return requireAuth(request);
}
