import { NextResponse } from "next/server";
import { formatBillingError, getOrCreateBillingProfile } from "@/lib/billing";
import { clientIp, purchaseRatelimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  getTokenPackage,
  type TokenPackageId,
} from "@/lib/tokenConfig";

export const runtime = "nodejs";

type YooPayment = {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
};

function yookassaAuthHeader(): string | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secret) return null;
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const ip = clientIp(request);
    const { success } = await purchaseRatelimit.limit(
      `purchase:${auth.user.id}:${ip}`
    );
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const body = (await request.json()) as { packageId?: string };
    const packageId = (body.packageId ?? "").trim() as TokenPackageId;
    const pack = getTokenPackage(packageId);

    if (!pack) {
      return NextResponse.json(
        { error: "Неизвестный пакет токенов" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    await getOrCreateBillingProfile(admin, auth.user);

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const returnUrl = `${origin}/dashboard?tokens=success&package=${pack.id}`;
    const amountValue = pack.price.toFixed(2);
    const authHeader = yookassaAuthHeader();

    // Заглушка: если ЮKassa не настроена — мгновенное тестовое пополнение
    if (!authHeader || process.env.YOOKASSA_STUB === "1") {
      const stubId = `stub_${Date.now()}_${auth.user.id.slice(0, 8)}`;
      const confirmUrl = `${origin}/api/purchase-tokens/stub-confirm?paymentId=${encodeURIComponent(stubId)}&packageId=${pack.id}&userId=${auth.user.id}`;

      return NextResponse.json({
        stub: true,
        paymentId: stubId,
        confirmationUrl: confirmUrl,
        package: pack,
        message:
          "ЮKassa не настроена — тестовая ссылка сразу зачислит токены",
      });
    }

    const idempotenceKey = crypto.randomUUID();
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify({
        amount: { value: amountValue, currency: "RUB" },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: returnUrl,
        },
        description: `WebComet: ${pack.tokens} токенов (${pack.id})`,
        metadata: {
          user_id: auth.user.id,
          package_id: pack.id,
          tokens: String(pack.tokens),
        },
      }),
    });

    const data = (await res.json()) as YooPayment & {
      description?: string;
      code?: string;
    };

    if (!res.ok) {
      console.error("yookassa create payment error:", data);
      return NextResponse.json(
        {
          error:
            data.description ||
            "Не удалось создать платёж ЮKassa. Проверьте ключи.",
        },
        { status: 502 }
      );
    }

    const confirmationUrl = data.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "ЮKassa не вернула ссылку на оплату" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      stub: false,
      paymentId: data.id,
      confirmationUrl,
      package: pack,
    });
  } catch (error) {
    console.error("purchase-tokens error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
