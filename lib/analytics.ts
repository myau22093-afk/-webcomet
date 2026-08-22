import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";

export type AnalyticsEventInput = {
  sessionId: string;
  eventName: string;
  eventLabel?: string | null;
  path?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  properties?: Record<string, unknown>;
};

export type AnalyticsVisitInput = {
  sessionId: string;
  path: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  userId?: string | null;
  userEmail?: string | null;
};

export type AnalyticsHeartbeatInput = {
  sessionId: string;
  path?: string | null;
  durationSec?: number;
  userId?: string | null;
  userEmail?: string | null;
};

function ipHash(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${ip}:wc-analytics`).digest("hex").slice(0, 32);
}

function isMissingTable(error: { message?: string } | null): boolean {
  const msg = error?.message ?? "";
  return /does not exist|relation|42P01|PGRST205/i.test(msg);
}

export async function recordVisit(input: AnalyticsVisitInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: existing } = await admin
      .from("analytics_sessions")
      .select("id, page_views, events_count")
      .eq("session_id", input.sessionId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("analytics_sessions")
        .update({
          last_path: input.path,
          last_seen_at: now,
          page_views: Number(existing.page_views ?? 0) + 1,
          user_id: input.userId ?? undefined,
          user_email: input.userEmail ?? undefined,
        })
        .eq("session_id", input.sessionId);
      return;
    }

    await admin.from("analytics_sessions").insert({
      session_id: input.sessionId,
      user_id: input.userId ?? null,
      user_email: input.userEmail ?? null,
      first_path: input.path,
      last_path: input.path,
      referrer: input.referrer ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      user_agent: input.userAgent ?? null,
      ip_hash: ipHash(input.ip),
      started_at: now,
      last_seen_at: now,
      page_views: 1,
      events_count: 0,
      duration_sec: 0,
    });
  } catch (error) {
    console.error("recordVisit:", error);
  }
}

export async function recordEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error: insErr } = await admin.from("analytics_events").insert({
      session_id: input.sessionId,
      user_id: input.userId ?? null,
      user_email: input.userEmail ?? null,
      event_name: input.eventName,
      event_label: input.eventLabel ?? null,
      path: input.path ?? null,
      properties: input.properties ?? {},
      created_at: now,
    });
    if (insErr && !isMissingTable(insErr)) {
      console.error("recordEvent insert:", insErr);
      return;
    }

    const { data: session } = await admin
      .from("analytics_sessions")
      .select("events_count")
      .eq("session_id", input.sessionId)
      .maybeSingle();

    if (session) {
      await admin
        .from("analytics_sessions")
        .update({
          last_seen_at: now,
          last_path: input.path ?? undefined,
          events_count: Number(session.events_count ?? 0) + 1,
          user_id: input.userId ?? undefined,
          user_email: input.userEmail ?? undefined,
        })
        .eq("session_id", input.sessionId);
    } else {
      await admin.from("analytics_sessions").insert({
        session_id: input.sessionId,
        user_id: input.userId ?? null,
        user_email: input.userEmail ?? null,
        first_path: input.path ?? "/",
        last_path: input.path ?? "/",
        started_at: now,
        last_seen_at: now,
        page_views: 0,
        events_count: 1,
      });
    }
  } catch (error) {
    console.error("recordEvent:", error);
  }
}

export async function recordHeartbeat(input: AnalyticsHeartbeatInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { last_seen_at: now };
    if (input.path) patch.last_path = input.path;
    if (typeof input.durationSec === "number" && input.durationSec >= 0) {
      patch.duration_sec = Math.floor(input.durationSec);
    }
    if (input.userId) patch.user_id = input.userId;
    if (input.userEmail) patch.user_email = input.userEmail;

    const { data } = await admin
      .from("analytics_sessions")
      .update(patch)
      .eq("session_id", input.sessionId)
      .select("id")
      .maybeSingle();

    if (!data) {
      await admin.from("analytics_sessions").insert({
        session_id: input.sessionId,
        user_id: input.userId ?? null,
        user_email: input.userEmail ?? null,
        first_path: input.path ?? "/",
        last_path: input.path ?? "/",
        started_at: now,
        last_seen_at: now,
        duration_sec: input.durationSec ?? 0,
      });
    }
  } catch (error) {
    console.error("recordHeartbeat:", error);
  }
}

export async function endSession(
  sessionId: string,
  durationSec?: number
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_seen_at: now,
      ended_at: now,
    };
    if (typeof durationSec === "number") {
      patch.duration_sec = Math.floor(durationSec);
    }
    await admin
      .from("analytics_sessions")
      .update(patch)
      .eq("session_id", sessionId);
  } catch (error) {
    console.error("endSession:", error);
  }
}
