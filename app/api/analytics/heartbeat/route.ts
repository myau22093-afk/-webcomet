import { NextResponse } from "next/server";
import { recordHeartbeat, endSession } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      path?: string;
      durationSec?: number;
      userId?: string;
      userEmail?: string;
      ended?: boolean;
    };

    const sessionId = body.sessionId?.trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (body.ended) {
      void endSession(sessionId, body.durationSec);
    } else {
      void recordHeartbeat({
        sessionId,
        path: body.path ?? null,
        durationSec: body.durationSec,
        userId: body.userId ?? null,
        userEmail: body.userEmail ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
