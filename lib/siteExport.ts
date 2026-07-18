import { readFile } from "fs/promises";
import path from "path";

export type ExportSiteInput = {
  html: string;
  css: string;
  js: string;
  /** Заголовок вкладки / SEO */
  title?: string;
  /** Email для заявок с формы (mailto) */
  formEmail?: string;
  /** Краткое описание для meta description */
  description?: string;
};

export type BundledAsset = {
  /** исходный путь вида /uploads/foo.png */
  sourcePath: string;
  /** путь в архиве: assets/foo.png */
  zipPath: string;
  /** относительный URL в HTML/CSS: assets/foo.png */
  publicPath: string;
  bytes: Buffer;
  contentType: string;
};

const UPLOAD_SRC_RE =
  /(?:src|href)\s*=\s*(["'])(\/uploads\/[^"'#?]+)\1/gi;
const UPLOAD_URL_RE =
  /url\(\s*(['"]?)(\/uploads\/[^"')\s]+)\1\s*\)/gi;
const UPLOAD_BARE_RE = /\/uploads\/[A-Za-z0-9._-]+/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeScriptContent(js: string): string {
  return js.replace(/<\/(script)/gi, "<\\/$1");
}

function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function extractTitleFromHtml(html: string, fallback: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const text = h1[1].replace(/<[^>]+>/g, "").trim();
    if (text) return text.slice(0, 80);
  }
  return fallback.slice(0, 80) || "Сайт";
}

function extractDescriptionFromHtml(html: string, fallback: string): string {
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (p?.[1]) {
    const text = p[1].replace(/<[^>]+>/g, "").trim();
    if (text) return text.slice(0, 160);
  }
  return fallback.slice(0, 160) || "Сайт, созданный в WebComet";
}

/** Все локальные /uploads/... упоминания в коде */
export function collectUploadPaths(
  html: string,
  css: string,
  js: string
): string[] {
  const found = new Set<string>();
  const blob = `${html}\n${css}\n${js}`;

  for (const re of [UPLOAD_SRC_RE, UPLOAD_URL_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob))) {
      found.add(m[2]);
    }
  }

  UPLOAD_BARE_RE.lastIndex = 0;
  let bare: RegExpExecArray | null;
  while ((bare = UPLOAD_BARE_RE.exec(blob))) {
    found.add(bare[0]);
  }

  return [...found];
}

function safeAssetFileName(uploadPath: string, index: number): string {
  const base = path.basename(uploadPath).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base || base === "." || base === "..") return `asset-${index}.bin`;
  return base;
}

/**
 * Читает файлы из public/uploads и готовит пакет для ZIP.
 * Небезопасные пути (path traversal) отбрасываются.
 */
export async function loadUploadAssets(
  uploadPaths: string[]
): Promise<BundledAsset[]> {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const assets: BundledAsset[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < uploadPaths.length; i++) {
    const sourcePath = uploadPaths[i];
    if (!sourcePath.startsWith("/uploads/")) continue;

    const rel = sourcePath.slice("/uploads/".length);
    if (!rel || rel.includes("..") || rel.includes("/") || rel.includes("\\")) {
      continue;
    }

    const abs = path.join(uploadsRoot, rel);
    if (!abs.startsWith(uploadsRoot)) continue;

    try {
      const bytes = await readFile(abs);
      let fileName = safeAssetFileName(sourcePath, i);
      if (usedNames.has(fileName)) {
        fileName = `${i}_${fileName}`;
      }
      usedNames.add(fileName);
      const zipPath = `assets/${fileName}`;
      assets.push({
        sourcePath,
        zipPath,
        publicPath: zipPath,
        bytes,
        contentType: guessContentType(fileName),
      });
    } catch {
      // файл мог быть удалён — пропускаем
    }
  }

  return assets;
}

export function rewriteUploadPaths(
  code: string,
  assets: BundledAsset[]
): string {
  let out = code;
  for (const asset of assets) {
    out = out.split(asset.sourcePath).join(asset.publicPath);
  }
  return out;
}

/** Заменяем /uploads на data: URL для одиночного HTML */
export function rewriteUploadsToDataUrls(
  code: string,
  assets: BundledAsset[]
): string {
  let out = code;
  for (const asset of assets) {
    const b64 = asset.bytes.toString("base64");
    const dataUrl = `data:${asset.contentType};base64,${b64}`;
    out = out.split(asset.sourcePath).join(dataUrl);
  }
  return out;
}

/**
 * Скрипт заявок для продакшена:
 * — Formspree / http(s) action → обычная отправка
 * — иначе mailto на formEmail (или первую mailto-ссылку на странице)
 */
export function buildFormHandlerJs(formEmail: string): string {
  const emailJson = JSON.stringify(formEmail.trim());
  return `
(function () {
  var FALLBACK_EMAIL = ${emailJson};

  function resolveEmail(form) {
    var fromForm = (form.getAttribute("data-mailto") || "").trim();
    if (fromForm) return fromForm.replace(/^mailto:/i, "");
    if (FALLBACK_EMAIL) return FALLBACK_EMAIL.replace(/^mailto:/i, "");
    var link = document.querySelector('a[href^="mailto:"]');
    if (link) {
      return (link.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0];
    }
    return "info@example.com";
  }

  function showThanks(form) {
    var box = document.createElement("p");
    box.setAttribute("data-wc-form-ok", "1");
    box.style.cssText = "margin-top:12px;padding:10px 12px;border-radius:10px;background:#ecfdf5;color:#065f46;font:14px/1.4 system-ui,sans-serif;";
    box.textContent = "Спасибо! Сейчас откроется почта — отправьте письмо, чтобы заявка ушла.";
    form.appendChild(box);
  }

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || form.tagName !== "FORM") return;

    var action = (form.getAttribute("action") || "").trim();
    if (/^https?:\\/\\//i.test(action) || /formspree\\.io/i.test(action)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    var data = new FormData(form);
    var lines = [];
    data.forEach(function (value, key) {
      if (typeof value === "string") lines.push(key + ": " + value);
    });
    if (!lines.length) lines.push("(форма без полей)");

    var email = resolveEmail(form);
    var subject = encodeURIComponent("Заявка с сайта");
    var body = encodeURIComponent(lines.join("\\n"));
    showThanks(form);
    window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;
  }, true);
})();`.trim();
}

export function prepareUserJs(js: string): string {
  // Убираем глобальный блок submit, если модель добавила «глушилку» форм
  return js
    .replace(
      /document\.addEventListener\(\s*['"]submit['"]\s*,\s*function\s*\([^)]*\)\s*\{[\s\S]*?preventDefault\(\);[\s\S]*?\}\s*,\s*true\s*\)\s*;?/gi,
      "/* WebComet: убран блокировщик форм */"
    )
    .replace(
      /document\.addEventListener\(\s*['"]submit['"]\s*,\s*\([^)]*\)\s*=>\s*\{[\s\S]*?preventDefault\(\);[\s\S]*?\}\s*,\s*true\s*\)\s*;?/gi,
      "/* WebComet: убран блокировщик форм */"
    );
}

export function ensureFormsHaveMailto(html: string, formEmail: string): string {
  const email = formEmail.trim();
  if (!email) return html;
  return html.replace(/<form\b([^>]*)>/gi, (full, attrs: string) => {
    if (/data-mailto\s*=/i.test(attrs)) return full;
    const safe = email.replace(/"/g, "");
    return `<form${attrs} data-mailto="${safe}">`;
  });
}

export type PreparedExport = {
  title: string;
  description: string;
  htmlBody: string;
  css: string;
  js: string;
  assets: BundledAsset[];
  formEmail: string;
};

export async function prepareExport(
  input: ExportSiteInput
): Promise<PreparedExport> {
  const title = (
    input.title?.trim() ||
    extractTitleFromHtml(input.html, "Сайт")
  ).slice(0, 80);
  const description = (
    input.description?.trim() ||
    extractDescriptionFromHtml(input.html, "")
  ).slice(0, 160);
  const formEmail = (input.formEmail || "").trim();

  const uploadPaths = collectUploadPaths(input.html, input.css, input.js);
  const assets = await loadUploadAssets(uploadPaths);

  const htmlBody = rewriteUploadPaths(
    ensureFormsHaveMailto(input.html || "", formEmail),
    assets
  );
  const css = rewriteUploadPaths(input.css || "", assets);
  const userJs = prepareUserJs(rewriteUploadPaths(input.js || "", assets));
  const js = [userJs.trim(), buildFormHandlerJs(formEmail)]
    .filter(Boolean)
    .join("\n\n");

  return { title, description, htmlBody, css, js, assets, formEmail };
}

/** Полноценный index.html для хостинга (ссылки на styles.css / script.js) */
export function buildProductionIndexHtml(parts: {
  title: string;
  description: string;
  htmlBody: string;
  /** если true — css/js инлайном (для одного файла) */
  inline?: boolean;
  css?: string;
  js?: string;
}): string {
  const title = escapeHtml(parts.title || "Сайт");
  const description = escapeHtml(
    parts.description || "Сайт, созданный в WebComet"
  );
  const body =
    parts.htmlBody?.trim() ||
    "<p style=\"padding:24px;font-family:system-ui\">Пустой сайт</p>";

  const headAssets = parts.inline
    ? `<style>
    html, body { margin: 0; min-height: 100%; }
    ${escapeScriptContent(parts.css ?? "")}
  </style>`
    : `<link rel="stylesheet" href="styles.css" />`;

  const footerScripts = parts.inline
    ? parts.js?.trim()
      ? `<script>${escapeScriptContent(parts.js)}</script>`
      : ""
    : `<script src="script.js" defer></script>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${description}" />
  <meta name="generator" content="WebComet" />
  <title>${title}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%237c3aed'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-size='28' fill='white' font-family='system-ui'%3EW%3C/text%3E%3C/svg%3E" />
  ${headAssets}
</head>
<body>
${body}
${footerScripts}
</body>
</html>
`;
}

/** Один HTML-файл со встроенными ассетами (data URL) */
export async function buildStandaloneHtml(
  input: ExportSiteInput
): Promise<string> {
  const uploadPaths = collectUploadPaths(input.html, input.css, input.js);
  const assets = await loadUploadAssets(uploadPaths);

  const htmlBody = rewriteUploadsToDataUrls(
    ensureFormsHaveMailto(input.html || "", input.formEmail || ""),
    assets
  );
  const css = rewriteUploadsToDataUrls(input.css || "", assets);
  const userJs = prepareUserJs(
    rewriteUploadsToDataUrls(input.js || "", assets)
  );
  const js = [userJs.trim(), buildFormHandlerJs(input.formEmail || "")]
    .filter(Boolean)
    .join("\n\n");

  return buildProductionIndexHtml({
    title: input.title?.trim() || extractTitleFromHtml(htmlBody, "Сайт"),
    description:
      input.description?.trim() ||
      extractDescriptionFromHtml(htmlBody, ""),
    htmlBody,
    inline: true,
    css,
    js,
  });
}

export function buildExportReadme(opts: {
  title: string;
  formEmail: string;
  assetCount: number;
}): string {
  return [
    "WebComet — экспорт сайта",
    "========================",
    "",
    `Название: ${opts.title}`,
    `Заявки (mailto): ${opts.formEmail || "берётся из ссылки mailto на странице"}`,
    `Файлов в assets/: ${opts.assetCount}`,
    "",
    "Как залить на хостинг (Рег.ру, Beget, Timeweb и т.п.):",
    "1. Распакуйте ZIP.",
    "2. Загрузите ВСЕ файлы в корневую папку сайта (public_html / www):",
    "   - index.html",
    "   - styles.css",
    "   - script.js",
    "   - папку assets/ (если есть)",
    "3. Откройте ваш домен в браузере.",
    "",
    "Что работает «из коробки»:",
    "- Вёрстка, CSS-анимации, меню, якоря",
    "- Телефон (tel:), почта (mailto:), соцсети",
    "- Форма заявки: открывает почтовый клиент с текстом заявки",
    "  (или отправляет на Formspree, если в action указан https://formspree.io/...)",
    "- Картинки из загрузки WebComet лежат в assets/",
    "",
    "Форма через Formspree (бесплатно, без открытия Outlook/Mail):",
    "1. Зарегистрируйтесь на https://formspree.io",
    "2. Создайте форму и скопируйте endpoint вида https://formspree.io/f/xxxxxxx",
    "3. В index.html у тега <form> поставьте action=\"https://formspree.io/f/xxxxxxx\" method=\"POST\"",
    "",
    "Карта:",
    "- Если на сайте iframe OpenStreetMap / ссылка на Яндекс.Карты — работает при интернете.",
    "- Если серая заглушка — замените на свой embed из конструктора карт.",
    "",
  ].join("\n");
}
