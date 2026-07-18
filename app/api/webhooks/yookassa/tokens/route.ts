import { NextResponse } from "next/server";
import { creditTokens, formatBillingError } from "@/lib/billing";
import { clientIp, webhookRatelimit } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenPackage } from "@/lib/tokenConfig";
import { verifyToken, verifyWebhookSecret } from "@/lib/webhookAuth";

export const runtime = "nodejs";

type YooWebhook = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    amount?: { value?: string };
    metadata?: {
      user_id?: string;
      package_id?: string;
      tokens?: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const { success } = await webhookRatelimit.limit(`yookassa:${ip}`);
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const rawBody = await request.text();
    const verified = verifyWebhookSecret(request, rawBody);
    if (!verified.ok) return verified.error;

    // Extra shared-secret check when Authorization Bearer is present
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const webhookSecret =
      process.env.YOOKASSA_WEBHOOK_SECRET?.trim() ||
      process.env.YOOKASSA_SECRET_KEY?.trim() ||
      "";
    if (
      webhookSecret &&
      process.env.YOOKASSA_STUB !== "1" &&
      bearer &&
      !verifyToken(bearer, webhookSecret)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}") as YooWebhook;
    const payment = body.object;
    const paymentId = payment?.id ?? "";
    const status = payment?.status ?? "";
    const event = body.event ?? "";

    console.log(
      `[yookassa] webhook event=${event} payment=${paymentId} status=${status}`
    );

    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "no payment id" });
    }

    if (status !== "succeeded" && event !== "payment.succeeded") {
      return NextResponse.json({ ok: true, skipped: "not succeeded" });
    }

    const userId = payment?.metadata?.user_id ?? "";
    const packageId = payment?.metadata?.package_id ?? "";
    const pack = getTokenPackage(packageId);
    const tokensFromMeta = Number(payment?.metadata?.tokens ?? 0);
    const tokens = pack?.tokens ?? tokensFromMeta;
    const amount = Number(payment?.amount?.value ?? pack?.price ?? 0);

    if (!userId || !tokens) {
      console.error("[yookassa] missing user_id or tokens in metadata", payment);
      return NextResponse.json(
        { error: "Нет user_id/tokens в metadata" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("yookassa_payment_id", paymentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const balance = await creditTokens(admin, userId, tokens, {
      amount,
      type: "purchase",
      description: `Покупка пакета ${packageId || "tokens"} через ЮKassa`,
      yookassaPaymentId: paymentId,
    });

    return NextResponse.json({ ok: true, balance, tokens });
  } catch (error) {
    console.error("yookassa tokens webhook error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
