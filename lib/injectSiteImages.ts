/**
 * Вставляет URL картинок в HTML сайта (hero + услуги) без полного ре-гена.
 */
export function injectSiteImages(html: string, urls: string[]): string {
  const list = urls.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (list.length === 0) return html;

  let out = html;
  let i = 0;

  const imgTag = (url: string, style: string) =>
    `<img src="${url}" alt="" data-wc-injected="1" style="${style}" />`;

  // Явные слоты
  out = out.replace(
    /(<[^>]*data-wc-slot=["'](?:hero|image|media|card)["'][^>]*>)/gi,
    (open) => {
      if (i >= list.length) return open;
      const url = list[i++];
      return `${open}${imgTag(
        url,
        "width:100%;height:auto;border-radius:1rem;display:block;margin:1rem 0;object-fit:cover"
      )}`;
    }
  );

  // Пустые медиа-блоки / плейсхолдеры
  out = out.replace(
    /<(div|figure|span)([^>]*(?:class=["'][^"']*(?:media|image|photo|visual|cover|placeholder|wc-media)[^"']*["']|data-wc-media)[^>]*)>\s*<\/\1>/gi,
    (full, tag, attrs) => {
      if (i >= list.length) return full;
      if (/data-wc-injected/i.test(full)) return full;
      const url = list[i++];
      return `<${tag}${attrs}>${imgTag(
        url,
        "width:100%;height:100%;min-height:160px;object-fit:cover;border-radius:inherit;display:block"
      )}</${tag}>`;
    }
  );

  // Hero-секция без картинки
  if (i < list.length) {
    out = out.replace(
      /(<section[^>]*(?:id=["'][^"']*hero[^"']*["']|class=["'][^"']*hero)[^>]*>)([\s\S]*?)(<\/section>)/i,
      (full, open, inner, close) => {
        if (/<img\s/i.test(inner) || i >= list.length) return full;
        const url = list[i++];
        return `${open}${inner}<div class="wc-hero-media" style="margin-top:1.25rem">${imgTag(
          url,
          "width:min(100%,640px);height:auto;border-radius:1rem;display:block"
        )}</div>${close}`;
      }
    );
  }

  // Карточки: article или div.card/service/...
  out = out.replace(
    /(<article\b[^>]*>)([\s\S]*?)(<\/article>)/gi,
    (full, open, inner, close) => {
      if (i >= list.length) return full;
      if (/<img\s/i.test(inner)) return full;
      if (inner.length > 1800) return full;
      const url = list[i++];
      return `${open}${imgTag(
        url,
        "width:100%;height:160px;object-fit:cover;border-radius:.75rem;margin-bottom:.75rem;display:block"
      )}${inner}${close}`;
    }
  );

  if (i < list.length) {
    out = out.replace(
      /(<div\b[^>]*class=["'][^"']*(?:card|service|feature|offer)[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/gi,
      (full, open, inner, close) => {
        if (i >= list.length) return full;
        if (/<img\s/i.test(inner)) return full;
        if (inner.length > 1800) return full;
        const url = list[i++];
        return `${open}${imgTag(
          url,
          "width:100%;height:160px;object-fit:cover;border-radius:.75rem;margin-bottom:.75rem;display:block"
        )}${inner}${close}`;
      }
    );
  }

  // Фоновые блоки с data-bg / style background без url
  if (i < list.length) {
    out = out.replace(
      /style=(["'])([^"']*background[^"']*)\1/gi,
      (full, q, style) => {
        if (i >= list.length) return full;
        if (/url\s*\(/i.test(style)) return full;
        if (!/background(?:-image)?\s*:/i.test(style)) return full;
        const url = list[i++];
        return `style=${q}${style};background-image:url(${url});background-size:cover;background-position:center${q}`;
      }
    );
  }

  return out;
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
