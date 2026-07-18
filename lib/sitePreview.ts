export function sanitizeSiteHtml(html: string): string {
  return html
    .replace(/\shref\s*=\s*(["'])https?:\/\/[^"']*\1/gi, ' href="#"')
    .replace(/\shref\s*=\s*(["'])\/\/[^"']*\1/gi, ' href="#"')
    // относительные ссылки иначе уводят iframe на localhost:3000 (наш дашборд)
    .replace(/\shref\s*=\s*(["'])\/[^"']*\1/gi, ' href="#"')
    .replace(/\shref\s*=\s*(["'])\.\.?\/[^"']*\1/gi, ' href="#"')
    .replace(/\saction\s*=\s*(["'])[^"']*\1/gi, ' action="#"')
    .replace(/\starget\s*=\s*(["'])_blank\1/gi, "")
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

export function buildPreviewHtml(parts: {
  html: string;
  css?: string;
  js?: string;
}): string {
  const safeHtml = sanitizeSiteHtml(parts.html || "");
  const css = escapeScriptContent(parts.css ?? "");
  const js = wrapPreviewJs(parts.js ?? "");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base href="about:srcdoc" target="_self" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #ffffff;
      color: #111827;
    }
    a { cursor: pointer; }
    button, [role="button"] { cursor: pointer; }
    ${css}
  </style>
</head>
<body>
${safeHtml || "<p style=\"padding:24px;font-family:system-ui\">Сайт не сгенерировался</p>"}
<script>
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!link) return;
    var href = link.getAttribute('href');
    if (href == null || href === '') {
      event.preventDefault();
      return;
    }
    // Только якоря внутри превью
    if (href.charAt(0) === '#') return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('submit', function (event) {
    event.preventDefault();
    event.stopPropagation();
  }, true);
</script>
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
