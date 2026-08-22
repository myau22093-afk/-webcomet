import { NextResponse } from "next/server";
import { isCrmAuthenticated } from "@/lib/crmAuth";
import { createAdminClient } from "@/lib/supabaseAdmin";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (!(await isCrmAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      sessionsRes,
      eventsRes,
      profilesRes,
      todaySessionsRes,
      activeSessionsRes,
    ] = await Promise.all([
      admin
        .from("analytics_sessions")
        .select(
          "session_id, started_at, last_seen_at, page_views, events_count, duration_sec, user_email, first_path, last_path, ended_at"
        )
        .gte("started_at", weekAgo.toISOString())
        .order("started_at", { ascending: false })
        .limit(500),
      admin
        .from("analytics_events")
        .select("event_name, event_label, created_at, session_id, user_email, path")
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("profiles")
        .select("id, email, token_balance, total_tokens_used, tier")
        .order("email")
        .limit(500),
      admin
        .from("analytics_sessions")
        .select("session_id", { count: "exact", head: true })
        .gte("started_at", todayStart.toISOString()),
      admin
        .from("analytics_sessions")
        .select("session_id", { count: "exact", head: true })
        .gte("last_seen_at", fiveMinAgo.toISOString()),
    ]);

    const tablesOk =
      !sessionsRes.error || !/does not exist|relation|42P01/i.test(sessionsRes.error.message ?? "");

    const sessions = sessionsRes.data ?? [];
    const events = eventsRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const visitsByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      visitsByDay[dayKey(d)] = 0;
    }
    for (const s of sessions) {
      const key = dayKey(new Date(s.started_at));
      if (key in visitsByDay) visitsByDay[key] += 1;
    }

    const eventCounts: Record<string, number> = {};
    for (const e of events) {
      eventCounts[e.event_name] = (eventCounts[e.event_name] ?? 0) + 1;
    }
    const topEvents = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));

    const signupEvents = events.filter(
      (e) => e.event_name === "signup" || e.event_name === "signup_complete"
    ).length;

    const uniqueWeek = new Set(sessions.map((s) => s.session_id)).size;

    return NextResponse.json({
      ok: true,
      tablesOk,
      stats: {
        todayVisits: todaySessionsRes.count ?? 0,
        weekUnique: uniqueWeek,
        activeNow: activeSessionsRes.count ?? 0,
        signupsWeek: signupEvents,
        totalUsers: profiles.length,
      },
      visitsByDay: Object.entries(visitsByDay).map(([date, count]) => ({
        date,
        count,
      })),
      topEvents,
      recentEvents: events.slice(0, 40),
      recentSessions: sessions.slice(0, 30).map((s) => ({
        sessionId: s.session_id,
        email: s.user_email,
        startedAt: s.started_at,
        lastSeenAt: s.last_seen_at,
        pageViews: s.page_views,
        eventsCount: s.events_count,
        durationSec: s.duration_sec,
        firstPath: s.first_path,
        lastPath: s.last_path,
        ended: Boolean(s.ended_at),
      })),
    });
  } catch (error) {
    console.error("crm dashboard:", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
