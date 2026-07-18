import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAuth } from "@/lib/requireUser";
import {
  buildExportReadme,
  buildProductionIndexHtml,
  buildStandaloneHtml,
  prepareExport,
} from "@/lib/siteExport";

export const runtime = "nodejs";

const MAX_PART_CHARS = 2_000_000;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      html?: string;
      css?: string;
      js?: string;
      title?: string;
      description?: string;
      formEmail?: string;
      /** zip (по умолчанию) | html — один файл со встроенными ассетами */
      format?: "zip" | "html";
    };

    const html = typeof body.html === "string" ? body.html : "";
    const css = typeof body.css === "string" ? body.css : "";
    const js = typeof body.js === "string" ? body.js : "";
    const format = body.format === "html" ? "html" : "zip";

    if (!html.trim() && !css.trim() && !js.trim()) {
      return NextResponse.json(
        { error: "Нет кода для экспорта" },
        { status: 400 }
      );
    }

    if (
      html.length > MAX_PART_CHARS ||
      css.length > MAX_PART_CHARS ||
      js.length > MAX_PART_CHARS
    ) {
      return NextResponse.json(
        { error: "Код слишком большой для экспорта" },
        { status: 413 }
      );
    }

    const exportInput = {
      html,
      css,
      js,
      title: typeof body.title === "string" ? body.title : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
      formEmail:
        typeof body.formEmail === "string"
          ? body.formEmail
          : auth.user.email || "",
    };

    if (format === "html") {
      const standalone = await buildStandaloneHtml(exportInput);
      return new NextResponse(standalone, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": 'attachment; filename="index.html"',
          "Cache-Control": "no-store",
        },
      });
    }

    const prepared = await prepareExport(exportInput);
    const indexHtml = buildProductionIndexHtml({
      title: prepared.title,
      description: prepared.description,
      htmlBody: prepared.htmlBody,
      inline: false,
    });

    const zip = new JSZip();
    zip.file("index.html", indexHtml);
    zip.file("styles.css", prepared.css);
    zip.file("script.js", prepared.js);

    for (const asset of prepared.assets) {
      zip.file(asset.zipPath, asset.bytes);
    }

    zip.file(
      "README.txt",
      buildExportReadme({
        title: prepared.title,
        formEmail: prepared.formEmail || auth.user.email || "",
        assetCount: prepared.assets.length,
      })
    );

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="webcomet-site.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("export-zip error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось создать экспорт",
      },
      { status: 500 }
    );
  }
}
