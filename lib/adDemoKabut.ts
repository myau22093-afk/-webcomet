import fs from "fs";
import path from "path";

/** Рекламный подставной сайт парикмахерской. */
export const AD_DEMO_KABUT_ENABLED = true;
export const AD_DEMO_KABUT_DELAY_MS = 60_000;
export const AD_DEMO_KABUT_PUBLIC = "/ad-demo-kabut";

const TRIGGER = "сделай сайт для парикмахерской";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Срабатывает на фразу для рекламы (тема / промпт / пожелания). */
export function isAdDemoKabutRequest(
  prompt: string,
  customRequirements = ""
): boolean {
  if (!AD_DEMO_KABUT_ENABLED) return false;
  const blob = norm(`${prompt}\n${customRequirements}`);
  return blob.includes(TRIGGER);
}

export type AdDemoKabutSite = {
  html: string;
  css: string;
  js: string;
};

let cached: AdDemoKabutSite | null = null;

export function loadAdDemoKabutSite(): AdDemoKabutSite {
  if (cached) return cached;

  const root = path.join(process.cwd(), "public", "ad-demo-kabut");
  const rawHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const rawCss = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rawJs = fs.readFileSync(path.join(root, "script.js"), "utf8");

  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : rawHtml;
  html = html
    .replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*>\s*<\/script>/gi, "")
    .replace(
      /(src=["'])(?!\/|https?:|data:)([^"']+)/gi,
      `$1${AD_DEMO_KABUT_PUBLIC}/$2`
    );

  const fonts = `@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap");\n`;

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
