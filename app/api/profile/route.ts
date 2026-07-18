import { NextResponse } from "next/server";
import {
  buildStatusPayload,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import {
  normalizeBrandColors,
  parseBrandColors,
} from "@/lib/brand";
import { createAdminClient, createUserClient } from "@/lib/supabaseAdmin";

async function authUser(request: Request) {
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, token };
}

export async function GET(request: Request) {
  try {
    const auth = await authUser(request);
    if ("error" in auth && auth.error) return auth.error;

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user!);
    return NextResponse.json(buildStatusPayload(profile));
  } catch (error) {
    console.error("profile API error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authUser(request);
    if ("error" in auth && auth.error) return auth.error;

    const body = (await request.json()) as {
      brand_logo?: string | null;
      brand_colors?: unknown;
    };

    const patch: Record<string, unknown> = {};

    if ("brand_logo" in body) {
      const logo =
        typeof body.brand_logo === "string" ? body.brand_logo.trim() : "";
      patch.brand_logo = logo || null;
    }

    if ("brand_colors" in body) {
      patch.brand_colors = normalizeBrandColors(
        Array.isArray(body.brand_colors)
          ? body.brand_colors
          : parseBrandColors(body.brand_colors)
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Нечего обновлять" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", auth.user!.id);

    if (error) {
      console.error("profile brand update error:", error);
      return NextResponse.json(
        {
          error:
            error.message?.includes("brand_")
              ? "Выполните supabase/migrate-brand.sql в Supabase (колонки brand_logo / brand_colors)"
              : formatBillingError(error),
        },
        { status: 500 }
      );
    }

    const profile = await getOrCreateBillingProfile(admin, auth.user!);
    return NextResponse.json(buildStatusPayload(profile));
  } catch (error) {
    console.error("profile PATCH error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
