import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { removeHostedIndex } from "@/lib/publish";

export const runtime = "nodejs";

/**
 * Пометить просроченные публикации и удалить статику /hosted.
 * Вызов: GET/POST /api/cron/expire-publishes
 * Заголовок: Authorization: Bearer $CRON_SECRET (или QUERY ?secret=)
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = new URL(request.url);
  const q = url.searchParams.get("secret") || "";
  if (!secret || (auth !== secret && q !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("published_sites")
    .select("id, slug")
    .eq("status", "active")
    .lt("expires_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  let updated = 0;
  for (const row of list) {
    const { error: upErr } = await admin
      .from("published_sites")
      .update({ status: "expired", updated_at: now })
      .eq("id", row.id)
      .eq("status", "active");
    if (!upErr) {
      updated += 1;
      await removeHostedIndex(String(row.slug));
    }
  }

  return NextResponse.json({
    ok: true,
    expired: updated,
    scanned: list.length,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
