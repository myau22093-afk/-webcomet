/**
 * Вставляет URL картинок в HTML сайта (hero + услуги) без полного ре-гена.
 */

export type InjectImagesResult = {
  html: string;
  injected: number;
};

function imgTag(url: string, style: string) {
  return `<img src="${url}" alt="" data-wc-injected="1" loading="lazy" style="${style}" />`;
}

const CARD_IMG_STYLE =
  "width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:.75rem;margin:0 0 .75rem;display:block;background:#e8e4df";
const HERO_IMG_STYLE =
  "width:100%;max-height:420px;object-fit:cover;border-radius:1rem;display:block;margin:1rem 0";

export function countInjectedImages(html: string): number {
  return (html.match(/data-wc-injected=["']1["']/g) || []).length;
}

export function injectSiteImages(html: string, urls: string[]): string {
  return injectSiteImagesDetailed(html, urls).html;
}

export function injectSiteImagesDetailed(
  html: string,
  urls: string[]
): InjectImagesResult {
  const list = urls.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (list.length === 0) return { html, injected: 0 };

  let out = html;
  let i = 0;
  const before = countInjectedImages(html);

  // 1) Явные слоты
  out = out.replace(
    /(<[^>]*\bdata-wc-slot=["'](?:hero|image|media|card)["'][^>]*>)/gi,
    (open) => {
      if (i >= list.length) return open;
      if (/data-wc-injected/i.test(open)) return open;
      const url = list[i++];
      const style = /hero/i.test(open) ? HERO_IMG_STYLE : CARD_IMG_STYLE;
      return `${open}${imgTag(url, style)}`;
    }
  );

  // 2) Пустые медиа / плейсхолдеры (в т.ч. с фоном и aspect-ratio)
  out = out.replace(
    /<(div|figure|span|section)(\b[^>]*?(?:class=["'][^"']*(?:media|image|photo|visual|cover|placeholder|wc-media|hero-media)[^"']*["']|data-wc-media|data-wc-slot)[^>]*)>\s*<\/\1>/gi,
    (full, tag, attrs) => {
      if (i >= list.length) return full;
      if (/data-wc-injected/i.test(full)) return full;
      const url = list[i++];
      return `<${tag}${attrs}>${imgTag(url, CARD_IMG_STYLE)}</${tag}>`;
    }
  );

  // 3) Пустые цветные блоки (часто Sol рисует «фото» фоном)
  out = out.replace(
    /<(div|figure)(\b[^>]*style=["'][^"']*(?:aspect-ratio|min-height\s*:\s*\d{2,}|background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8})[^"']*["'][^>]*)>\s*<\/\1>/gi,
    (full, tag, attrs) => {
      if (i >= list.length) return full;
      if (/data-wc-injected/i.test(full)) return full;
      if (/<(?:nav|header|footer|form|button|a)\b/i.test(full)) return full;
      const url = list[i++];
      return `<${tag}${attrs}>${imgTag(url, CARD_IMG_STYLE)}</${tag}>`;
    }
  );

  // 4) Hero без картинки
  if (i < list.length) {
    out = out.replace(
      /(<section[^>]*(?:id=["'][^"']*hero[^"']*["']|class=["'][^"']*hero)[^>]*>)([\s\S]*?)(<\/section>)/i,
      (full, open, inner, close) => {
        if (/<img\s/i.test(inner) || i >= list.length) return full;
        const url = list[i++];
        return `${open}${inner}<div class="wc-hero-media">${imgTag(
          url,
          HERO_IMG_STYLE
        )}</div>${close}`;
      }
    );
  }

  // 5) Карточки article / .card — в начало, если нет img
  const wrapCard = (full: string, open: string, inner: string, close: string) => {
    if (i >= list.length) return full;
    if (/data-wc-injected|<\s*img\s/i.test(inner)) return full;
    if (inner.length > 2500) return full;
    const url = list[i++];
    // если внутри пустой цветной div — заменяем его
    const replaced = inner.replace(
      /<(div|figure)(\b[^>]*)>\s*<\/\1>/i,
      (_m, tag, attrs) => `<${tag}${attrs}>${imgTag(url, CARD_IMG_STYLE)}</${tag}>`
    );
    if (replaced !== inner) return `${open}${replaced}${close}`;
    return `${open}${imgTag(url, CARD_IMG_STYLE)}${inner}${close}`;
  };

  out = out.replace(
    /(<article\b[^>]*>)([\s\S]*?)(<\/article>)/gi,
    (full, open, inner, close) => wrapCard(full, open, inner, close)
  );

  if (i < list.length) {
    out = out.replace(
      /(<div\b[^>]*class=["'][^"']*(?:card|service|feature|offer|grid-item)[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/gi,
      (full, open, inner, close) => wrapCard(full, open, inner, close)
    );
  }

  // 6) Фоновые style без url
  if (i < list.length) {
    out = out.replace(
      /style=(["'])([^"']*background[^"']*)\1/gi,
      (full, q, style) => {
        if (i >= list.length) return full;
        if (/url\s*\(/i.test(style)) return full;
        if (!/background(?:-image)?\s*:/i.test(style)) return full;
        if (/background-color\s*:/i.test(style) && !/background-image/i.test(style)) {
          // цветной блок — лучше вставить img рядом не через background только
        }
        const url = list[i++];
        return `style=${q}${style};background-image:url('${url}');background-size:cover;background-position:center${q}`;
      }
    );
  }

  // 7) Фолбэк: галерея внизу, чтобы картинки точно были на сайте
  if (i < list.length) {
    const rest = list.slice(i);
    i = list.length;
    const gallery = `<section data-wc-gallery="1" style="padding:2.5rem 5%;display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${rest
      .map((url) => imgTag(url, CARD_IMG_STYLE))
      .join("")}</section>`;
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${gallery}</body>`);
    } else {
      out = `${out}\n${gallery}`;
    }
  }

  const injected = countInjectedImages(out) - before;
  return { html: out, injected: Math.max(injected, 0) };
}

export function imagePromptsFromBrief(
  topic: string,
  nicheName?: string | null
) {
  const base = [topic, nicheName].filter(Boolean).join(", ");
  return [
    `Professional website hero photograph, modern interior or product, cinematic lighting, no text, no watermark, ${base}`,
    `Clean service photo for website card, product or workplace, soft light, no text, ${base}`,
    `Second service photo, different angle, premium quality, no text, ${base}`,
  ];
}
