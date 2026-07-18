import { NextResponse } from "next/server";
import { listChats } from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const items = await listChats(auth.user.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("history/chats error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить историю чата" },
      { status: 500 }
    );
  }
}
