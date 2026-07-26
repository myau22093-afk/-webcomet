import { NextResponse } from "next/server";
import { getOrCreateBillingProfile } from "@/lib/billing";
import { getSiteById } from "@/lib/history";
import { syncPublishedSiteContent } from "@/lib/publish";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Залить актуальный HTML/CSS/JS на уже опубликованный поддомен */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      siteId?: string;
      html?: string;
      css?: string;
      js?: string;
      title?: string;
    };

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
        { error: "Нет HTML для обновления" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const result = await syncPublishedSiteContent(admin, {
      userId: auth.user.id,
      siteId,
      html,
      css,
      js,
      title: title || "Сайт",
      formEmail: profile.email ?? undefined,
    });

    if (!result.updated) {
      return NextResponse.json(
        {
          error:
            "Активной публикации не найдено. Сначала опубликуй сайт, потом правки появятся по кнопке «Обновить на сайте».",
          updated: 0,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: result.updated,
      slugs: result.slugs,
    });
  } catch (error) {
    console.error("publish sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось обновить сайт",
      },
      { status: 500 }
    );
  }
}
