import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";

const MAX_EVENTS_PER_MIN = 120;

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(sessionId: string): boolean {
  const now = Date.now();
  const b = buckets.get(sessionId);
  if (!b || now > b.reset) {
    buckets.set(sessionId, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (b.count >= MAX_EVENTS_PER_MIN) return false;
  b.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      eventName?: string;
      eventLabel?: string;
      path?: string;
      userId?: string;
      userEmail?: string;
      properties?: Record<string, unknown>;
    };

    const sessionId = body.sessionId?.trim();
    const eventName = body.eventName?.trim().slice(0, 80);
    if (!sessionId || !eventName) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!rateLimit(sessionId)) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    void recordEvent({
      sessionId,
      eventName,
      eventLabel: body.eventLabel?.slice(0, 200) ?? null,
      path: body.path?.slice(0, 500) ?? null,
      userId: body.userId ?? null,
      userEmail: body.userEmail ?? null,
      properties: body.properties ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
