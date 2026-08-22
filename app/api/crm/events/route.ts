import { NextResponse } from "next/server";
import { isCrmAuthenticated } from "@/lib/crmAuth";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!(await isCrmAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const email = searchParams.get("email")?.trim();
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit")) || 80));

  try {
    const admin = createAdminClient();

    if (sessionId) {
      const { data: events, error } = await admin
        .from("analytics_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;

      const { data: session } = await admin
        .from("analytics_sessions")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();

      return NextResponse.json({ session, events: events ?? [] });
    }

    let query = admin
      .from("analytics_events")
      .select(
        "id, session_id, event_name, event_label, path, user_email, created_at, properties"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (email) {
      query = query.ilike("user_email", `%${email}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    console.error("crm events:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
