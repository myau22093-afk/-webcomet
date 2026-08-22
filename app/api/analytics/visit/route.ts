import { NextResponse } from "next/server";
import { recordVisit } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      path?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      userId?: string;
      userEmail?: string;
    };

    const sessionId = body.sessionId?.trim();
    const path = body.path?.trim() || "/";
    if (!sessionId || sessionId.length < 8 || sessionId.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    void recordVisit({
      sessionId,
      path,
      referrer: body.referrer ?? null,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      userAgent: request.headers.get("user-agent"),
      ip,
      userId: body.userId ?? null,
      userEmail: body.userEmail ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
