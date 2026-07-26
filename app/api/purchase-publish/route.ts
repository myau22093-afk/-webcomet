import { NextResponse } from "next/server";
import { formatBillingError, getOrCreateBillingProfile } from "@/lib/billing";
import { getSiteById } from "@/lib/history";
import {
  buildPublishHtml,
  reservePublishSlug,
  urlsForSlug,
} from "@/lib/publish";
import {
  getPublishPackage,
} from "@/lib/publishConfig";
import { clientIp, purchaseRatelimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";

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
      `publish:${auth.user.id}:${ip}`
    );
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }

    const body = (await request.json()) as {
      packageId?: string;
      siteId?: string;
      html?: string;
      css?: string;
      js?: string;
      title?: string;
    };

    const pack = getPublishPackage(body.packageId);
    if (!pack) {
      return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
    }

    const admin = createAdminClient();
    await getOrCreateBillingProfile(admin, auth.user);

    let html = body.html?.trim() ?? "";
    let css = body.css?.trim() ?? "";
    let js = body.js?.trim() ?? "";
    let title = body.title?.trim() ?? "";
    const siteId = body.siteId?.trim() || null;

    if ((!html || html.length < 20) && siteId) {
      const site = await getSiteById(auth.user.id, siteId);
      if (!site) {
        return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
      }
      html = site.html ?? "";
      css = site.css ?? "";
      js = site.js ?? "";
      title = title || site.prompt?.slice(0, 80) || "Сайт";
    }

    if (!html || html.length < 20) {
      return NextResponse.json(
        { error: "Нет HTML для публикации" },
        { status: 400 }
      );
    }

    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const standalone = await buildPublishHtml({
      html,
      css,
      js,
      title: title || "Сайт",
      formEmail: profile.email ?? undefined,
    });

    const draft = await reservePublishSlug(admin, auth.user.id, {
      siteId,
      title: title || "Сайт",
      html: standalone,
      packageId: pack.id,
    });

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const returnUrl = `${origin}/dashboard?publish=success&slug=${draft.slug}`;
    const amountValue = pack.price.toFixed(2);
    const authHeader = yookassaAuthHeader();
    const urls = urlsForSlug(draft.slug);

    if (!authHeader || process.env.YOOKASSA_STUB === "1") {
      const stubId = `stub_pub_${Date.now()}_${auth.user.id.slice(0, 8)}`;
      const confirmUrl = `${origin}/api/purchase-publish/stub-confirm?paymentId=${encodeURIComponent(stubId)}&packageId=${pack.id}&userId=${auth.user.id}&publishId=${draft.id}`;

      return NextResponse.json({
        stub: true,
        paymentId: stubId,
        confirmationUrl: confirmUrl,
        package: pack,
        slug: draft.slug,
        urls,
        publishId: draft.id,
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
        description: `WebComet публикация: ${pack.label} · ${draft.slug}`,
        metadata: {
          product: "publish",
          user_id: auth.user.id,
          package_id: pack.id,
          publish_id: draft.id,
          slug: draft.slug,
          months: String(pack.months),
        },
      }),
    });

    const data = (await res.json()) as YooPayment & { description?: string };

    if (!res.ok) {
      console.error("yookassa publish payment error:", data);
      return NextResponse.json(
        { error: "Не удалось создать платёж. Попробуйте ещё раз." },
        { status: 502 }
      );
    }

    const confirmationUrl = data.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Не удалось получить ссылку на оплату" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      stub: false,
      paymentId: data.id,
      confirmationUrl,
      package: pack,
      slug: draft.slug,
      urls,
      publishId: draft.id,
    });
  } catch (error) {
    console.error("purchase-publish error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка публикации" },
      { status: 500 }
    );
  }
}
