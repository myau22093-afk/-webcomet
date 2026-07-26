import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getPublishedBySlug, isPublishActive } from "@/lib/publish";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function expiredHtml(): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Срок истёк</title></head><body style="margin:0;font-family:system-ui,sans-serif;background:#0a0a0f;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center"><div><h1 style="font-size:22px;margin:0 0 8px">Публикация закончилась</h1><p style="margin:0;opacity:.7;font-size:14px">Продлите сайт в WebComet или скачайте ZIP.</p><p style="margin:16px 0 0"><a href="https://webcomet.ru/dashboard" style="color:#a78bfa">Открыть WebComet</a></p></div></body></html>`;
}

function notFoundHtml(): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Не найдено</title></head><body style="margin:0;font-family:system-ui,sans-serif;background:#0a0a0f;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center"><div><h1 style="font-size:22px;margin:0 0 8px">Сайт не найден</h1><p style="margin:0;opacity:.7;font-size:14px">Проверьте ссылку или опубликуйте сайт заново.</p></div></body></html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await context.params;
  const slug = (raw || "").toLowerCase().trim();

  if (!/^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const admin = createAdminClient();
    const row = await getPublishedBySlug(admin, slug);

    if (!row) {
      return new NextResponse(notFoundHtml(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!isPublishActive(row)) {
      if (row.status === "active" && row.expires_at) {
        await admin
          .from("published_sites")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      return new NextResponse(expiredHtml(), {
        status: 410,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    let html = row.html ?? "";
    if (!html) {
      try {
        html = await readFile(
          path.join(process.cwd(), "public", "hosted", slug, "index.html"),
          "utf8"
        );
      } catch {
        html = "";
      }
    }

    if (!html) {
      return new NextResponse(notFoundHtml(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("public site serve error:", error);
    return new NextResponse(notFoundHtml(), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
