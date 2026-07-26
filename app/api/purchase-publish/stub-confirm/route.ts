import { NextResponse } from "next/server";
import { formatBillingError } from "@/lib/billing";
import { activatePublish, urlsForSlug } from "@/lib/publish";
import { getPublishPackage } from "@/lib/publishConfig";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (
      process.env.YOOKASSA_SHOP_ID &&
      process.env.YOOKASSA_SECRET_KEY &&
      process.env.YOOKASSA_STUB !== "1"
    ) {
      return NextResponse.json(
        { error: "Stub отключён — используйте реальную ЮKassa" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const paymentId = url.searchParams.get("paymentId") ?? "";
    const packageId = url.searchParams.get("packageId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    const publishId = url.searchParams.get("publishId") ?? "";
    const pack = getPublishPackage(packageId);

    if (!paymentId || !userId || !pack || !publishId) {
      return NextResponse.json(
        { error: "Некорректные параметры" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const row = await activatePublish(admin, {
      publishId,
      userId,
      packageId: pack.id,
      paymentId,
      amount: pack.price,
    });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const urls = urlsForSlug(row.slug);
    return NextResponse.redirect(
      `${origin}/dashboard?publish=live&slug=${encodeURIComponent(row.slug)}&url=${encodeURIComponent(urls.path)}`
    );
  } catch (error) {
    console.error("publish stub-confirm error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка" },
      { status: 500 }
    );
  }
}
