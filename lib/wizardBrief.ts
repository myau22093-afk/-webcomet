import {
  SITE_SECTION_OPTIONS,
  type SiteSectionId,
  defaultSections,
} from "@/lib/brand";
import {
  SITE_TEMPLATES,
  getTemplateById,
  matchSiteTemplate,
} from "@/lib/siteTemplates";

export type WizardPalette = {
  id: string;
  label: string;
  colors: string[];
};

export const WIZARD_PALETTES: WizardPalette[] = [
  {
    id: "violet",
    label: "Фиолетовый",
    colors: ["#6c3bf4", "#f5f3ff", "#0b0f19"],
  },
  {
    id: "ocean",
    label: "Океан",
    colors: ["#0ea5e9", "#e0f2fe", "#0c4a6e"],
  },
  {
    id: "forest",
    label: "Зелень",
    colors: ["#16a34a", "#ecfdf5", "#14532d"],
  },
  {
    id: "sunset",
    label: "Тёплый",
    colors: ["#ea580c", "#fff7ed", "#1c1917"],
  },
  {
    id: "mono",
    label: "Монохром",
    colors: ["#a1a1aa", "#fafafa", "#09090b"],
  },
];

export type WizardTier = "simple" | "premium";

export type WizardBrief = {
  topic: string;
  notes: string;
  companyName: string;
  city: string;
  phone: string;
  seoFocus: string;
  detailsConfirmed: boolean;
  /** null = ещё не спросили; true = брать из Настроек */
  useSettingsContacts: boolean | null;
  /** Референсы дизайна (URL после upload) */
  referenceUrls: string[];
  logoUrl: string | null;
  /** Текст ТЗ, если загрузили .txt/.md */
  tzText: string;
  tzFileName: string | null;
  assetsConfirmed: boolean;
  paletteId: string | null;
  colors: string[];
  sections: SiteSectionId[];
  sectionsConfirmed: boolean;
  nicheId: string | null;
  tier: WizardTier | null;
  /** Каркас Simple из витрины / structureTemplates */
  structureLayoutId: string | null;
};

export type WizardUiStep =
  | "topic"
  | "palette"
  | "details"
  | "contacts"
  | "assets"
  | "sections"
  | "tier"
  | "ready";

export function emptyWizardBrief(): WizardBrief {
  return {
    topic: "",
    notes: "",
    companyName: "",
    city: "",
    phone: "",
    seoFocus: "",
    detailsConfirmed: false,
    useSettingsContacts: null,
    referenceUrls: [],
    logoUrl: null,
    tzText: "",
    tzFileName: null,
    assetsConfirmed: false,
    paletteId: null,
    colors: [...WIZARD_PALETTES[0].colors],
    sections: defaultSections(),
    sectionsConfirmed: true,
    nicheId: null,
    tier: null,
    structureLayoutId: null,
  };
}

export function detectNicheFromTopic(topic: string): string | null {
  return matchSiteTemplate(topic)?.id ?? null;
}

/** Вытащить город из фразы темы, если человек написал «в СПб» и т.п. */
export function extractCityFromTopic(topic: string): string {
  const t = topic.trim();
  const aliases: [RegExp, string][] = [
    [/\b(?:в\s+)?(?:спб|питер|петербург|санкт[-\s]?петербург)\b/i, "Санкт-Петербург"],
    [/\b(?:в\s+)?(?:мск|москв[аеу])\b/i, "Москва"],
    [/\b(?:в\s+)?(?:екатеринбург|екб)\b/i, "Екатеринбург"],
    [/\b(?:в\s+)?новосибирск\w*\b/i, "Новосибирск"],
    [/\b(?:в\s+)?краснодар\w*\b/i, "Краснодар"],
    [/\b(?:в\s+)?казан\w*\b/i, "Казань"],
    [/\b(?:в\s+)?сочи\b/i, "Сочи"],
    [/\b(?:в\s+)?улан[-\s]?уд[эе]\b/i, "Улан-Удэ"],
  ];
  for (const [re, city] of aliases) {
    if (re.test(t)) return city;
  }
  const m = t.match(
    /(?:в|по)\s+([А-ЯЁ][а-яё]+(?:[-\s][А-ЯЁа-яё]+)?)/
  );
  return m?.[1]?.trim() ?? "";
}

/** Простое предложение SEO/гео без жаргона и без «нейросетевого» длинного тире */
export function suggestSeoFocus(brief: Pick<
  WizardBrief,
  "topic" | "companyName" | "city"
>): string {
  return suggestSeoPhrases(brief)[0] ?? "";
}

/** Несколько фраз, как люди реально ищут в Яндексе/Google */
export function suggestSeoPhrases(brief: Pick<
  WizardBrief,
  "topic" | "companyName" | "city"
>): string[] {
  const topic = brief.topic.trim().replace(/\s+/g, " ").replace(/[—–]/g, " ");
  const city = brief.city.trim().replace(/[—–]/g, " ");
  const company = brief.companyName.trim().replace(/[—–]/g, " ");
  if (!topic) return [];

  const out: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (!t) return;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    out.push(t);
  };

  // «магазин клубники» → продукт «клубника», не «заказать магазин клубники»
  const productMatch = topic.match(
    /^(?:магазин|сайт|студия|салон|клиника|кафе|ресторан|служба|сервис)\s+(.+)$/i
  );
  const product = (productMatch?.[1] || topic)
    .replace(/^(?:по\s+)?продаже\s+/i, "")
    .trim();

  if (city) {
    add(`${topic} ${city}`);
    add(`${product} ${city}`);
    add(`${product} с доставкой ${city}`);
  } else {
    add(topic);
    if (product.toLowerCase() !== topic.toLowerCase()) add(product);
  }
  if (company) {
    add(company);
    if (city) add(`${company} ${city}`);
  }
  if (
    product &&
    !/^(магазин|сайт|студия|салон|клиника|служба|сервис)\b/i.test(product)
  ) {
    add(`заказать ${product}${city ? ` ${city}` : ""}`);
  }

  return out.slice(0, 4);
}

export function parseSeoPhrases(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((s) => s.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function joinSeoPhrases(phrases: string[]): string {
  return phrases
    .map((s) => s.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function isBriefReady(brief: WizardBrief): boolean {
  return (
    brief.topic.trim().length >= 3 &&
    Boolean(brief.paletteId) &&
    brief.colors.length >= 2 &&
    brief.detailsConfirmed &&
    brief.companyName.trim().length >= 2 &&
    brief.useSettingsContacts !== null &&
    brief.assetsConfirmed &&
    brief.sectionsConfirmed &&
    brief.sections.length >= 2 &&
    Boolean(brief.tier)
  );
}

export function nextScriptedStep(
  brief: WizardBrief,
  opts?: { hasProfileContacts?: boolean }
): WizardUiStep | null {
  if (!brief.topic.trim() || brief.topic.trim().length < 3) return "topic";
  if (!brief.paletteId) return "palette";
  if (!brief.detailsConfirmed || brief.companyName.trim().length < 2) {
    return "details";
  }
  if (opts?.hasProfileContacts && brief.useSettingsContacts === null) {
    return "contacts";
  }
  if (!brief.assetsConfirmed) return "assets";
  if (!brief.sectionsConfirmed || brief.sections.length < 2) return "sections";
  if (!brief.tier) return "tier";
  return "ready";
}

export function modelIdForTier(tier: WizardTier | null): string {
  return tier === "premium" ? "claude-fable-5" : "gpt-5.6-sol";
}

/** Премиум в Мастере: полная генерация с нуля (не structure-adapt) */
export function isWizardPremiumModel(modelId: string | null | undefined): boolean {
  if (!modelId) return false;
  return modelId === "claude-fable-5" || modelId.includes("fable");
}

export function buildWizardSitePrompt(brief: WizardBrief): {
  prompt: string;
  customRequirements: string;
  brandColors: string[];
  sections: SiteSectionId[];
  nicheName: string | null;
  templateId: string | null;
  modelId: string;
} {
  const nicheId =
    brief.nicheId ?? detectNicheFromTopic(brief.topic) ?? null;
  const niche = nicheId ? getTemplateById(nicheId) : null;
  const sectionLabels = SITE_SECTION_OPTIONS.filter((s) =>
    brief.sections.includes(s.id)
  )
    .map((s) => s.label)
    .join(", ");

  const premium =
    brief.tier === "premium"
      ? [
          "PREMIUM: визуально на голову выше обычного лендинга.",
          "Обязательны плавные анимации появления секций (короткие, 0.3–0.5s), hover на кнопках.",
          "Не делай «шаблонный» плоский сайт — ощущение дорогого студийного продукта.",
          "НЕ делай плавающие карточки с медленной бесконечной анимацией и кривым наложением поверх контента.",
        ]
      : [
          "SIMPLE: чистый современный лендинг без лишней сложности.",
          "Лёгкие hover-эффекты допустимы, тяжёлые/медленные анимации запрещены.",
          "Никаких плавающих карточек поверх дашборда с бесконечным float.",
        ];

  const prompt = [
    `Создай современный лендинг.`,
    `Тема / бизнес: ${brief.topic.trim()}`,
    brief.companyName.trim()
      ? `Название компании / бренда: ${brief.companyName.trim()}`
      : null,
    brief.city.trim() ? `Город / гео: ${brief.city.trim()}` : null,
    brief.phone.trim() ? `Телефон на сайте: ${brief.phone.trim()}` : null,
    niche ? `Ниша: ${niche.name}` : null,
    `Уровень: ${brief.tier === "premium" ? "премиум" : "простой"}`,
    `Секции сайта: ${sectionLabels}`,
    `Цвета бренда: ${brief.colors.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const customRequirements = [
    brief.notes.trim() || null,
    brief.seoFocus.trim()
      ? `Поисковые запросы (вплети естественно в title, H1 и тексты; не используй длинное тире; пиши как люди в поиске):\n${parseSeoPhrases(brief.seoFocus).join("\n")}`
      : null,
    brief.logoUrl
      ? `Логотип компании: используй <img src="${brief.logoUrl}" alt="${brief.companyName || "logo"}" /> в шапке.`
      : null,
    brief.referenceUrls.length
      ? `Референсы стиля (ориентируйся на настроение/композицию, не копируй 1в1): ${brief.referenceUrls.join(", ")}`
      : null,
    brief.tzText.trim()
      ? `Техническое задание от клиента:\n${brief.tzText.trim().slice(0, 4000)}`
      : null,
    ...premium,
    "Сделай законченный продающий лендинг на русском.",
    "Кнопки и якорные ссылки должны работать.",
    'В hero и карточках услуг добавь явные слоты: пустые <div data-wc-slot="hero"> и <div data-wc-slot="image"> без картинок внутри — туда позже вставятся фото.',
    "Не оставляй огромные пустые зоны: секции плотные, вертикальные отступы умеренные (примерно 64–96px).",
    "Анимации только короткие fade/slide при появлении; без бесконечного «парения» карточек.",
    "Не выдумывай чужой город: используй только указанный город/гео. Если город не указан — пиши без привязки к городу.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt,
    customRequirements,
    brandColors: brief.colors,
    sections: brief.sections,
    nicheName: niche?.name ?? null,
    templateId: niche?.id ?? null,
    modelId: modelIdForTier(brief.tier),
  };
}

export const WIZARD_CHAT_MODEL_ID = "deepseek-chat";
export const WIZARD_IMAGE_MODEL_IDS = [
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
  "gpt-image-2",
] as const;
export const WIZARD_STORAGE_KEY = "wc-wizard-v3";

export function nicheOptions() {
  return SITE_TEMPLATES.map((t) => ({ id: t.id, label: t.name }));
}

export function sectionOptions() {
  return SITE_SECTION_OPTIONS.map((s) => ({ id: s.id, label: s.label }));
}
