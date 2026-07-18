import { NextResponse } from "next/server";
import { getNextSiteVersion, saveSite } from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      html?: string;
      css?: string;
      js?: string;
      rootPrompt?: string;
      prompt?: string;
      note?: string;
    };

    const html = body.html?.trim() ?? "";
    const rootPrompt = (body.rootPrompt ?? body.prompt ?? "").trim();
    if (!html || !rootPrompt) {
      return NextResponse.json(
        { error: "Нужны html и rootPrompt" },
        { status: 400 }
      );
    }

    const version = await getNextSiteVersion(auth.user.id, rootPrompt);
    const note = body.note?.trim();
    const promptLabel = note
      ? `${rootPrompt} · v${version}: ${note}`
      : `${rootPrompt} · v${version}`;

    const saved = await saveSite({
      userId: auth.user.id,
      prompt: promptLabel,
      html,
      css: body.css ?? "",
      js: body.js ?? "",
      version,
      rootPrompt,
    });

    if (!saved) {
      return NextResponse.json(
        { error: "Не удалось сохранить версию" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: saved.id,
      version: saved.version ?? version,
      prompt: saved.prompt,
      root_prompt: saved.root_prompt ?? rootPrompt,
      html: saved.html,
      css: saved.css,
      js: saved.js,
      created_at: saved.created_at,
    });
  } catch (error) {
    console.error("save-site-version error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения версии" },
      { status: 500 }
    );
  }
}
