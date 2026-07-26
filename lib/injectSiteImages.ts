/**
 * Вставляет URL картинок в HTML сайта (hero + услуги) без полного ре-гена.
 * Раздача: по одной на карточку/слот, без кучкования в первых блоках.
 */

export type InjectImagesResult = {
  html: string;
  injected: number;
};

export type ImageSlotInfo = {
  /** Сколько пустых мест под фото сейчас */
  slots: number;
  hasHeroGap: boolean;
  emptyCards: number;
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

/** Сколько мест под картинки осталось (1..8) */
export function countImageSlots(html: string): ImageSlotInfo {
  const raw = html || "";
  let emptyCards = 0;
  let hasHeroGap = false;

  const hero =
    raw.match(
      /<section[^>]*(?:id=["'][^"']*hero[^"']*["']|class=["'][^"']*hero)[^>]*>[\s\S]*?<\/section>/i
    )?.[0] ?? "";
  if (
    hero &&
    !/<img\s/i.test(hero) &&
    !/background-image\s*:\s*url\s*\(/i.test(hero)
  ) {
    hasHeroGap = true;
  }

  const articles = raw.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) || [];
  for (const a of articles) {
    if (!/<img\s/i.test(a)) emptyCards++;
  }

  if (emptyCards === 0) {
    const cards =
      raw.match(
        /<div\b[^>]*class=["'][^"']*(?:card|service|feature|offer)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
      ) || [];
    for (const c of cards) {
      if (c.length > 2500) continue;
      if (!/<img\s/i.test(c)) emptyCards++;
    }
  }

  // явные слоты без картинки рядом (грубо)
  let slotAttrs = 0;
  const slotRe =
    /<([a-z0-9]+)([^>]*\bdata-wc-slot=["'](?:hero|image|media|card)["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = slotRe.exec(raw))) {
    if (!/<img\s/i.test(m[0])) slotAttrs++;
  }

  let slots = Math.max(
    emptyCards + (hasHeroGap ? 1 : 0),
    slotAttrs,
    hasHeroGap || emptyCards ? emptyCards + (hasHeroGap ? 1 : 0) : 0
  );

  // если разметки нет — всё равно даём выбрать 1–4
  if (slots < 1) slots = 3;
  slots = Math.min(8, Math.max(1, slots));

  return { slots, hasHeroGap, emptyCards };
}

function fillOneIntoBlock(block: string, url: string, hero = false): string {
  const style = hero ? HERO_IMG_STYLE : CARD_IMG_STYLE;
  const tag = imgTag(url, style);
  // пустой первый div/figure → заменить
  const replaced = block.replace(
    /<(div|figure)(\b[^>]*)>\s*<\/\1>/i,
    (_m, t, attrs) => `<${t}${attrs}>${tag}</${t}>`
  );
  if (replaced !== block) return replaced;
  // открывающий тег article/section/div
  return block.replace(
    /^(<[a-z0-9]+\b[^>]*>)/i,
    `$1${tag}`
  );
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

  // 1) Карточки без фото — строго по одной
  out = out.replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi, (block) => {
    if (i >= list.length) return block;
    if (/<img\s/i.test(block)) return block;
    return fillOneIntoBlock(block, list[i++]);
  });

  if (i < list.length) {
    out = out.replace(
      /<div\b[^>]*class=["'][^"']*(?:card|service|feature|offer)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
      (block) => {
        if (i >= list.length) return block;
        if (block.length > 2500) return block;
        if (/<img\s/i.test(block)) return block;
        return fillOneIntoBlock(block, list[i++]);
      }
    );
  }

  // 2) Hero без фото — одна
  if (i < list.length) {
    out = out.replace(
      /(<section[^>]*(?:id=["'][^"']*hero[^"']*["']|class=["'][^"']*hero)[^>]*>)([\s\S]*?)(<\/section>)/i,
      (full, open, inner, close) => {
        if (i >= list.length) return full;
        if (/<img\s/i.test(inner)) return full;
        if (/background-image\s*:\s*url\s*\(/i.test(full)) return full;
        const url = list[i++];
        return `${open}${fillOneIntoBlock(inner, url, true)}${close}`;
      }
    );
  }

  // 3) Явные слоты ещё без img
  if (i < list.length) {
    out = out.replace(
      /<([a-z0-9]+)([^>]*\bdata-wc-slot=["'](?:hero|image|media|card)["'][^>]*)>([\s\S]*?)<\/\1>/gi,
      (full, tag, attrs, inner) => {
        if (i >= list.length) return full;
        if (/<img\s/i.test(full)) return full;
        const url = list[i++];
        const hero = /hero/i.test(attrs);
        return `<${tag}${attrs}>${imgTag(
          url,
          hero ? HERO_IMG_STYLE : CARD_IMG_STYLE
        )}${inner}</${tag}>`;
      }
    );
  }

  // 4) Оставшиеся пустые цветные плейсхолдеры (по одному, не внутри блоков с img)
  if (i < list.length) {
    out = out.replace(
      /<(div|figure)(\b[^>]*style=["'][^"']*(?:aspect-ratio|min-height\s*:\s*\d{2,}|background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8})[^"']*["'][^>]*)>\s*<\/\1>/gi,
      (full, tag, attrs) => {
        if (i >= list.length) return full;
        if (/data-wc-injected/i.test(full)) return full;
        const url = list[i++];
        return `<${tag}${attrs}>${imgTag(url, CARD_IMG_STYLE)}</${tag}>`;
      }
    );
  }

  // 5) Лишние URL — компактная галерея (только если пользователь заказал больше слотов)
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
  nicheName?: string | null,
  count = 3
) {
  const base = [topic, nicheName].filter(Boolean).join(", ");
  const n = Math.min(8, Math.max(1, count));
  const templates = [
    `Professional website hero photograph, modern interior or product, cinematic lighting, no text, no watermark, ${base}`,
    `Clean service photo for website card, product or workplace, soft light, no text, ${base}`,
    `Second service photo, different angle, premium quality, no text, ${base}`,
    `Lifestyle photo for website section, natural light, no text, ${base}`,
    `Detail product or ambience photo, sharp focus, no text, ${base}`,
    `Wide establishing shot for web banner, no text, ${base}`,
    `Close-up texture or food/service detail, no text, ${base}`,
    `Team or customer moment photo, candid, no text, ${base}`,
  ];
  return templates.slice(0, n);
}
