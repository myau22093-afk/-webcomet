import { NextResponse } from "next/server";
import {
  deleteChatExchange,
  deleteHistoryItem,
  getSiteById,
  type HistoryKind,
} from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";

const KINDS = new Set<HistoryKind>(["sites", "images", "chats"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const { id } = await context.params;
    const type = new URL(request.url).searchParams.get("type") ?? "sites";

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    if (type !== "sites") {
      return NextResponse.json(
        { error: "GET поддерживается только для type=sites" },
        { status: 400 }
      );
    }

    const item = await getSiteById(auth.user.id, id);
    if (!item) {
      return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("history get error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить запись" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const { id } = await context.params;
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "") as HistoryKind;

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    if (!KINDS.has(type)) {
      return NextResponse.json(
        { error: "type должен быть sites | images | chats" },
        { status: 400 }
      );
    }

    if (type === "chats") {
      const deletedIds = await deleteChatExchange(auth.user.id, id);
      if (deletedIds.length === 0) {
        return NextResponse.json(
          { error: "Запись не найдена" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, deletedIds });
    }

    const ok = await deleteHistoryItem(type, id, auth.user.id);
    if (!ok) {
      return NextResponse.json(
        { error: "Запись не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deletedIds: [id] });
  } catch (error) {
    console.error("history delete error:", error);
    return NextResponse.json(
      { error: "Не удалось удалить запись" },
      { status: 500 }
    );
  }
}
