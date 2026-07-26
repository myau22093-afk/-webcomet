import { NextResponse } from "next/server";
import { creditTokens, formatBillingError } from "@/lib/billing";
import { activatePublish } from "@/lib/publish";
import { getPublishPackage } from "@/lib/publishConfig";
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
      product?: string;
      user_id?: string;
      package_id?: string;
      tokens?: string;
      publish_id?: string;
      slug?: string;
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
      `[yookassa] webhook event=${event} payment=${paymentId} status=${status} product=${payment?.metadata?.product ?? "tokens"}`
    );

    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "no payment id" });
    }

    if (status !== "succeeded" && event !== "payment.succeeded") {
      return NextResponse.json({ ok: true, skipped: "not succeeded" });
    }

    const meta = payment?.metadata ?? {};
    const userId = meta.user_id ?? "";
    const packageId = meta.package_id ?? "";
    const amount = Number(payment?.amount?.value ?? 0);
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
