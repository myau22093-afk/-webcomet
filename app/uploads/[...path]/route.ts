import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Раздача runtime-загрузок в Docker standalone (public/uploads с volume). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const parts = (await context.params).path ?? [];
  if (parts.length === 0 || parts.some((p) => p.includes("..") || p.includes("/") || p.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileName = parts.join("/");
  const root = path.join(process.cwd(), "public", "uploads");
  const abs = path.join(root, fileName);
  if (!abs.startsWith(root)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    await stat(abs);
    const buf = await readFile(abs);
    const ext = path.extname(fileName).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
