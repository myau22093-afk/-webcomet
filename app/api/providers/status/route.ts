import { NextResponse } from "next/server";
import { listProviderHealth } from "@/lib/providers";
import { groupModelsByProvider } from "@/lib/models";
import { requireAuth } from "@/lib/requireUser";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    return NextResponse.json({
      providers: listProviderHealth(),
      models: {
        site: groupModelsByProvider("site"),
        image: groupModelsByProvider("image"),
        chat: groupModelsByProvider("chat"),
      },
    });
  } catch (error) {
    console.error("providers/status error:", error);
    return NextResponse.json(
      { error: "Не удалось получить статус провайдеров" },
      { status: 500 }
    );
  }
}
