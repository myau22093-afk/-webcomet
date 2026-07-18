import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { LOGO_MAX_BYTES, validateLogoFile } from "@/lib/brand";
import { createUserClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createUserClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const kind = String(formData.get("kind") ?? "").toLowerCase();
    const isLogo = kind === "logo";
    const files = formData.getAll("files").filter((item): item is File => {
      return typeof item === "object" && item !== null && "arrayBuffer" in item;
    });

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Файлы не переданы" },
        { status: 400 }
      );
    }

    if (isLogo) {
      const file = files[0];
      const err = validateLogoFile(file);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    } else {
      for (const file of files) {
        if (file.size > LOGO_MAX_BYTES * 4) {
          return NextResponse.json(
            { error: `Файл слишком большой: ${file.name}` },
            { status: 400 }
          );
        }
      }
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const urls: string[] = [];
    const toSave = isLogo ? files.slice(0, 1) : files;

    for (const file of toSave) {
      const originalName = sanitizeFileName(file.name || "file");
      const uniqueName = `${Date.now()}_${originalName}`;
      const filePath = path.join(uploadsDir, uniqueName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      urls.push(`/uploads/${uniqueName}`);
    }

    return NextResponse.json({ urls, url: urls[0] ?? null });
  } catch (error) {
    console.error("upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ошибка загрузки файлов",
      },
      { status: 500 }
    );
  }
}
