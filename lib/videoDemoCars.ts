import fs from "fs";
import path from "path";

/**
 * ВРЕМЕННО для съёмки ролика.
 * После видео: VIDEO_DEMO_CARS_ENABLED = false и удали public/video-demo-cars + этот файл.
 */
export const VIDEO_DEMO_CARS_ENABLED = true;
export const VIDEO_DEMO_CARS_DELAY_MS = 60_000;

const TRIGGER = "сделай премиальный сайт для аренды машин";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Срабатывает только на точную фразу для видео (тема / промпт / пожелания). */
export function isVideoDemoCarsRequest(
  prompt: string,
  customRequirements = ""
): boolean {
  if (!VIDEO_DEMO_CARS_ENABLED) return false;
  const blob = norm(`${prompt}\n${customRequirements}`);
  return blob.includes(TRIGGER);
}

export type VideoDemoCarsSite = {
  html: string;
  css: string;
  js: string;
};

let cached: VideoDemoCarsSite | null = null;

export function loadVideoDemoCarsSite(): VideoDemoCarsSite {
  if (cached) return cached;

  const root = path.join(process.cwd(), "public", "video-demo-cars");
  const rawHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const rawCss = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rawJs = fs.readFileSync(path.join(root, "script.js"), "utf8");

  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : rawHtml;
  html = html
    .replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*>\s*<\/script>/gi, "")
    .replace(/(src=["'])images\//gi, "$1/video-demo-cars/images/");

  const fonts = `@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700;800&display=swap");\n`;

  cached = {
    html: html.trim(),
    css: fonts + rawCss,
    js: rawJs,
  };
  return cached;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
