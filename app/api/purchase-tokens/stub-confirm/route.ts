import { NextResponse } from "next/server";
import { creditTokens, formatBillingError } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenPackage } from "@/lib/tokenConfig";

export const runtime = "nodejs";

/**
 * Тестовое подтверждение покупки без ЮKassa.
 * Только когда YOOKASSA не настроена или YOOKASSA_STUB=1.
 */
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
    const pack = getTokenPackage(packageId);

    if (!paymentId || !userId || !pack) {
      return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("yookassa_payment_id", paymentId)
      .maybeSingle();

    if (existing) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.redirect(
        `${origin}/dashboard?tokens=already&package=${pack.id}`
      );
    }

    await creditTokens(admin, userId, pack.tokens, {
      amount: pack.price,
      type: "purchase",
      description: `Тестовая покупка пакета ${pack.id}`,
      yookassaPaymentId: paymentId,
    });

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    return NextResponse.redirect(
      `${origin}/dashboard?tokens=credited&package=${pack.id}&amount=${pack.tokens}`
    );
  } catch (error) {
    console.error("stub-confirm error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
