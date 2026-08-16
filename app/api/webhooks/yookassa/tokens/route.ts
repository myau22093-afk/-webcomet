import { NextResponse } from "next/server";
import { creditTokens, formatBillingError } from "@/lib/billing";
import { activatePublish } from "@/lib/publish";
import { getPublishPackage } from "@/lib/publishConfig";
import { clientIp, webhookRatelimit } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenPackage } from "@/lib/tokenConfig";
import {
  fetchYooKassaPayment,
  isYooKassaIp,
} from "@/lib/yookassa";

export const runtime = "nodejs";

type YooWebhook = {
  type?: string;
  event?: string;
  object?: {
    id?: string;
    status?: string;
    amount?: { value?: string };
    metadata?: {
      product?: string;
      user_id?: string;
      package_id?: string;
      tokens?: string;
      publish_id?: string;
      slug?: string;
    };
  };
};

/** ЮKassa при сохранении URL шлёт GET — нужен 200. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const { success } = await webhookRatelimit.limit(`yookassa:${ip}`);
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const rawBody = await request.text();
    let body: YooWebhook = {};
    try {
      body = JSON.parse(rawBody || "{}") as YooWebhook;
    } catch {
      body = {};
    }

    const payment = body.object;
    const paymentId = payment?.id ?? "";
    const event = body.event ?? "";

    // Пинг при настройке webhook или пустое тело — отвечаем 200
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // В проде принимаем только с IP ЮKassa (или localhost для отладки)
    const fromYoo =
      isYooKassaIp(ip) ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("172.18.") ||
      ip.startsWith("172.17.");

    if (!fromYoo && process.env.YOOKASSA_STUB !== "1") {
      console.warn(`[yookassa] webhook rejected ip=${ip} payment=${paymentId}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const verified = await fetchYooKassaPayment(paymentId);
    if (!verified) {
      console.error(`[yookassa] cannot verify payment=${paymentId}`);
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 502 }
      );
    }
    const status = verified.status ?? "";

    console.log(
      `[yookassa] webhook event=${event} payment=${paymentId} status=${status} product=${verified.metadata?.product ?? payment?.metadata?.product ?? "tokens"} ip=${ip}`
    );

    if (status !== "succeeded") {
      return NextResponse.json({ ok: true, skipped: "not succeeded" });
    }

    const meta = {
      ...(payment?.metadata ?? {}),
      ...(verified.metadata ?? {}),
    };
    const userId = meta.user_id ?? "";
    const packageId = meta.package_id ?? "";
    const amount = Number(verified.amount?.value ?? payment?.amount?.value ?? 0);
    const admin = createAdminClient();

    if (meta.product === "publish") {
      if (!userId || !packageId || !meta.publish_id) {
        return NextResponse.json(
          { error: "Нет user_id/package_id/publish_id" },
          { status: 400 }
        );
      }
      const pack = getPublishPackage(packageId);
      if (!pack) {
        return NextResponse.json(
          { error: "Unknown publish package" },
          { status: 400 }
        );
      }
      const row = await activatePublish(admin, {
        publishId: meta.publish_id,
        userId,
        packageId: pack.id,
        paymentId,
        amount: amount || pack.price,
      });
      return NextResponse.json({
        ok: true,
        product: "publish",
        slug: row.slug,
        expires_at: row.expires_at,
      });
    }

    const pack = getTokenPackage(packageId);
    const tokensFromMeta = Number(meta.tokens ?? 0);
    const tokens = pack?.tokens ?? tokensFromMeta;

    if (!userId || !tokens) {
      console.error("[yookassa] missing user_id or tokens in metadata", payment);
      return NextResponse.json(
        { error: "Нет user_id/tokens в metadata" },
        { status: 400 }
      );
    }

    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("yookassa_payment_id", paymentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const balance = await creditTokens(admin, userId, tokens, {
      amount: amount || pack?.price || 0,
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
