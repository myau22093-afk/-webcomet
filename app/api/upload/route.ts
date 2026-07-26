import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { LOGO_MAX_BYTES, validateLogoFile } from "@/lib/brand";
import { createUserClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type IncomingFile = { name: string; type: string; buffer: Buffer };

async function materializeFormFiles(
  formData: FormData
): Promise<IncomingFile[]> {
  const staged: Array<{ name: string; type: string; blob: Blob }> = [];
  for (const [key, value] of formData.entries()) {
    if (key === "kind") continue;
    if (typeof value === "string") continue;
    const blob = value as Blob & { name?: string };
    if (!blob || typeof blob.arrayBuffer !== "function") continue;
    const name =
      typeof (value as File).name === "string" && (value as File).name
        ? (value as File).name
        : `upload_${key}.bin`;
    staged.push({
      name,
      type: blob.type || "application/octet-stream",
      blob,
    });
  }
  const out: IncomingFile[] = [];
  for (const s of staged) {
    const buffer = Buffer.from(await s.blob.arrayBuffer());
    if (buffer.length === 0) continue;
    out.push({ name: s.name, type: s.type, buffer });
  }
  return out;
}

async function collectFromJson(body: {
  kind?: string;
  files?: Array<{ name?: string; type?: string; dataBase64?: string }>;
  file?: { name?: string; type?: string; dataBase64?: string };
}): Promise<IncomingFile[]> {
  const list = [
    ...(Array.isArray(body.files) ? body.files : []),
    ...(body.file ? [body.file] : []),
  ];
  const out: IncomingFile[] = [];
  for (const item of list) {
    const b64 = item.dataBase64?.replace(/^data:[^;]+;base64,/, "").trim();
    if (!b64) continue;
    const buffer = Buffer.from(b64, "base64");
    if (buffer.length === 0) continue;
    out.push({
      name: item.name || "upload.bin",
      type: item.type || "application/octet-stream",
      buffer,
    });
  }
  return out;
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

    const contentType = request.headers.get("content-type") || "";
    let kind = "";
    let files: IncomingFile[] = [];

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        kind?: string;
        files?: Array<{ name?: string; type?: string; dataBase64?: string }>;
        file?: { name?: string; type?: string; dataBase64?: string };
      };
      kind = String(body.kind ?? "").toLowerCase();
      files = await collectFromJson(body);
    } else {
      const formData = await request.formData();
      kind = String(formData.get("kind") ?? "").toLowerCase();
      files = await materializeFormFiles(formData);
    }

    const isLogo = kind === "logo";

    if (files.length === 0) {
      return NextResponse.json(
        {
          error:
            "Файлы не переданы. Попробуй другой формат (PNG/JPG) или другой браузер.",
        },
        { status: 400 }
      );
    }

    if (isLogo) {
      const file = files[0];
      const fakeFile = {
        name: file.name,
        type: file.type,
        size: file.buffer.length,
      } as File;
      const err = validateLogoFile(fakeFile);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    } else {
      for (const file of files) {
        if (file.buffer.length > LOGO_MAX_BYTES * 4) {
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
      await writeFile(filePath, file.buffer);
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
