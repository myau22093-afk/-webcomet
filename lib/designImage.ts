import { readFile } from "fs/promises";
import path from "path";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** Локальный /uploads/... → data URL для vision-моделей */
export async function designImageToDataUrl(
  designImage: string
): Promise<string | null> {
  const trimmed = designImage.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  const rel = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (!rel.startsWith("uploads/")) {
    return null;
  }

  const filePath = path.join(process.cwd(), "public", rel);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "image/png";
  const buf = await readFile(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}
