import { NextResponse } from "next/server";
import { listImages } from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const items = await listImages(auth.user.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("history/images error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить историю изображений" },
      { status: 500 }
    );
  }
}
