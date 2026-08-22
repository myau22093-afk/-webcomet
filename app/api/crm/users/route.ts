import { NextResponse } from "next/server";
import { isCrmAuthenticated } from "@/lib/crmAuth";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!(await isCrmAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const admin = createAdminClient();
    let query = admin
      .from("profiles")
      .select("id, email, token_balance, total_tokens_used, tier, phone")
      .order("email")
      .limit(100);

    if (q) {
      query = query.ilike("email", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const userIds = (data ?? []).map((u) => u.id);
    let lastSeen: Record<string, string> = {};
    if (userIds.length) {
      const { data: sessions } = await admin
        .from("analytics_sessions")
        .select("user_id, last_seen_at")
        .in("user_id", userIds)
        .order("last_seen_at", { ascending: false })
        .limit(200);
      for (const s of sessions ?? []) {
        if (s.user_id && !lastSeen[s.user_id]) {
          lastSeen[s.user_id] = s.last_seen_at;
        }
      }
    }

    return NextResponse.json({
      users: (data ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        tokenBalance: u.token_balance ?? 0,
        totalUsed: u.total_tokens_used ?? 0,
        tier: u.tier,
        phone: u.phone,
        lastSeenAt: lastSeen[u.id] ?? null,
      })),
    });
  } catch (error) {
    console.error("crm users:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
