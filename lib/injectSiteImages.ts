/**
 * Вставляет URL картинок в HTML сайта (hero + услуги) без полного ре-гена.
 */
export function injectSiteImages(
  html: string,
  urls: string[]
): string {
  const list = urls.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (list.length === 0) return html;

  let out = html;
  let i = 0;

  // Явные слоты
  out = out.replace(/data-wc-slot=["']hero["'][^>]*>/i, (m) => {
    const url = list[i++] ?? list[0];
    if (!url) return m;
    return `${m}<img src="${url}" alt="" style="width:100%;height:auto;border-radius:1rem;display:block;margin:1rem 0" />`;
  });

  // Первый hero-блок без картинки
  if (i < list.length) {
    out = out.replace(
      /(<section[^>]*(?:id=["']hero["']|class=["'][^"']*hero)[^>]*>)([\s\S]*?)(<\/section>)/i,
      (full, open, inner, close) => {
        if (/<img\s/i.test(inner) || i >= list.length) return full;
        const url = list[i++];
        return `${open}${inner}<div class="wc-hero-media" style="margin-top:1.25rem"><img src="${url}" alt="" style="width:min(100%,640px);height:auto;border-radius:1rem" /></div>${close}`;
      }
    );
  }

  // Карточки услуг
  out = out.replace(
    /(<article\b[^>]*>)([\s\S]*?)(<\/article>)/gi,
    (full, open, inner, close) => {
      if (i >= list.length) return full;
      if (/<img\s/i.test(inner)) return full;
      const url = list[i++];
      return `${open}<img src="${url}" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:.75rem;margin-bottom:.75rem" />${inner}${close}`;
    }
  );

  return out;
}

export function imagePromptsFromBrief(topic: string, nicheName?: string | null) {
  const base = [topic, nicheName].filter(Boolean).join(", ");
  return [
    `Website hero photo, professional, modern, no text, ${base}`,
    `Service illustration photo 1, clean, no text, ${base}`,
    `Service illustration photo 2, clean, no text, ${base}`,
  ];
}
