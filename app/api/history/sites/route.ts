import { NextResponse } from "next/server";
import { listSites } from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const items = await listSites(auth.user.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("history/sites error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить историю сайтов" },
      { status: 500 }
    );
  }
}
