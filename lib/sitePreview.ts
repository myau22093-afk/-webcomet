export function sanitizeSiteHtml(html: string): string {
  return html
    .replace(/\shref\s*=\s*(["'])https?:\/\/[^"']*\1/gi, ' href="#"')
    .replace(/\shref\s*=\s*(["'])\/\/[^"']*\1/gi, ' href="#"')
    // относительные ссылки иначе уводят iframe на webcomet.ru / dashboard
    .replace(/\shref\s*=\s*(["'])\/(?!uploads\/)[^"']*\1/gi, ' href="#"')
    .replace(/\shref\s*=\s*(["'])\.\.?\/[^"']*\1/gi, ' href="#"')
    .replace(/\saction\s*=\s*(["'])[^"']*\1/gi, ' action="#"')
    .replace(/\starget\s*=\s*(["'])_blank\1/gi, "")
    .replace(/\starget\s*=\s*(["'])_top\1/gi, "")
    .replace(/\starget\s*=\s*(["'])_parent\1/gi, "")
    .replace(/\srel\s*=\s*(["'])[^"']*\1/gi, "");
}

/** Экранирует закрытие script-тега, чтобы user JS не ломал документ */
function escapeScriptContent(js: string): string {
  return js.replace(/<\/(script)/gi, "<\\/$1");
}

function wrapPreviewJs(js: string): string {
  const safe = escapeScriptContent(js.trim());
  if (!safe) return "";
  return `
(function () {
  try {
${safe}
  } catch (err) {
    console.error("[WebComet preview JS]", err);
    try {
      var box = document.createElement("div");
      box.setAttribute("data-wc-js-error", "1");
      box.style.cssText = "position:fixed;bottom:8px;left:8px;right:8px;z-index:99999;background:#7f1d1d;color:#fff;padding:10px 12px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);";
      box.textContent = "Ошибка JS в превью: " + (err && err.message ? err.message : String(err));
      document.body.appendChild(box);
    } catch (_) {}
  }
})();`;
}

/** Origin для /uploads в iframe srcdoc (иначе картинки не грузятся) */
export function resolvePreviewAssetOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      return env.replace(/\/$/, "");
    }
  }
  return "";
}

/** /uploads/... и /video-demo-cars/... → абсолютные URL, чтобы превью в srcdoc их видело */
export function absolutizeUploadUrls(content: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  if (!base) return content;
  return content
    .replace(
      /\b(src|href)=(["'])(\/(?:uploads|video-demo-cars)\/[^"']+)\2/gi,
      (_m, attr, q, path) => `${attr}=${q}${base}${path}${q}`
    )
    .replace(
      /url\(\s*(['"]?)(\/(?:uploads|video-demo-cars)\/[^"')\s]+)\1\s*\)/gi,
      (_m, q, path) => `url(${q}${base}${path}${q})`
    );
}

/** Блокирует уход из превью на webcomet.ru / другие страницы */
const PREVIEW_NAV_LOCK = `
(function () {
  function isSafeHref(href) {
    if (href == null || href === '' || href === '#') return true;
    if (href.charAt(0) === '#') return true;
    if (/^javascript:/i.test(href)) return false;
    return false;
  }
  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('a,[href]') : null;
    if (!el) return;
    var href = el.getAttribute('href');
    if (isSafeHref(href)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }, true);
  document.addEventListener('submit', function (event) {
    event.preventDefault();
    event.stopPropagation();
  }, true);
  try {
    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('button,[role="button"]') : null;
      if (!btn) return;
      // не даём кнопкам уводить через form action / default
      var form = btn.closest && btn.closest('form');
      if (form && btn.getAttribute('type') !== 'button') {
        event.preventDefault();
      }
    }, true);
  } catch (_) {}
  try {
    var noop = function () {};
    if (window.top && window.top !== window) {
      try {
        Object.defineProperty(window, 'top', { get: function () { return window; } });
      } catch (_) {}
      try {
        Object.defineProperty(window, 'parent', { get: function () { return window; } });
      } catch (_) {}
    }
    var freezeLoc = function () {
      try {
        var loc = window.location;
        var block = function (url) {
          if (!url || String(url).charAt(0) === '#') return;
          return;
        };
        loc.assign = function (url) { block(url); };
        loc.replace = function (url) { block(url); };
      } catch (_) {}
    };
    freezeLoc();
  } catch (_) {}
})();
`;

export function buildPreviewHtml(parts: {
  html: string;
  css?: string;
  js?: string;
  /** например https://webcomet.ru — для картинок /uploads */
  assetOrigin?: string;
}): string {
  const origin = parts.assetOrigin || resolvePreviewAssetOrigin();
  const safeHtml = absolutizeUploadUrls(
    sanitizeSiteHtml(parts.html || ""),
    origin
  );
  const css = absolutizeUploadUrls(
    escapeScriptContent(parts.css ?? ""),
    origin
  );
  const js = wrapPreviewJs(parts.js ?? "");
  // НЕ ставим <base href="https://webcomet.ru/"> — из‑за него клики уводили превью на лендинг WebComet

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base target="_self" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #ffffff;
      color: #111827;
    }
    a { cursor: pointer; }
    button, [role="button"] { cursor: pointer; }
    img[data-wc-injected="1"] { max-width: 100%; height: auto; }
    ${css}
  </style>
</head>
<body>
${safeHtml || "<p style=\"padding:24px;font-family:system-ui\">Сайт не сгенерировался</p>"}
<script>${PREVIEW_NAV_LOCK}</script>
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}

export const EMPTY_SITE_HTML =
  '<section style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:32px;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;"><div><h1 style="margin:0 0 12px;font-size:28px;">Сайт не сгенерировался</h1><p style="margin:0;opacity:.8;">Попробуйте ещё раз или смените модель.</p></div></section>';

export type GenerationItem = {
  id: string;
  prompt: string;
  rootPrompt: string;
  version: number;
  customRequirements: string;
  images: string[];
  designImage?: string;
  html: string;
  css: string;
  js: string;
  previewHtml: string;
  createdAt: string;
};
