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
  paletteId: string | null;
  colors: string[];
  sections: SiteSectionId[];
  sectionsConfirmed: boolean;
  nicheId: string | null;
  tier: WizardTier | null;
};

export type WizardUiStep =
  | "topic"
  | "palette"
  | "details"
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
    paletteId: null,
    colors: [...WIZARD_PALETTES[0].colors],
    sections: defaultSections(),
    sectionsConfirmed: true,
    nicheId: null,
    tier: null,
  };
}

export function detectNicheFromTopic(topic: string): string | null {
  return matchSiteTemplate(topic)?.id ?? null;
}

export function isBriefReady(brief: WizardBrief): boolean {
  return (
    brief.topic.trim().length >= 3 &&
    Boolean(brief.paletteId) &&
    brief.colors.length >= 2 &&
    brief.detailsConfirmed &&
    brief.companyName.trim().length >= 2 &&
    brief.sectionsConfirmed &&
    brief.sections.length >= 2 &&
    Boolean(brief.tier)
  );
}

export function nextScriptedStep(brief: WizardBrief): WizardUiStep | null {
  if (!brief.topic.trim() || brief.topic.trim().length < 3) return "topic";
  if (!brief.paletteId) return "palette";
  if (!brief.detailsConfirmed || brief.companyName.trim().length < 2) {
    return "details";
  }
  if (!brief.sectionsConfirmed || brief.sections.length < 2) return "sections";
  if (!brief.tier) return "tier";
  return "ready";
}

export function modelIdForTier(tier: WizardTier | null): string {
  return tier === "premium" ? "claude-fable-5" : "gpt-5.6-sol";
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
      ? `SEO / GEO: ориентируйся на запросы и регион: ${brief.seoFocus.trim()}. Title, H1 и тексты должны включать гео и ключевые слова естественно.`
      : null,
    ...premium,
    "Сделай законченный продающий лендинг на русском.",
    "Кнопки и якорные ссылки должны работать.",
    "В hero и блоке услуг оставь места под изображения (data-wc-slot или пустые медиа-блоки).",
    "Не оставляй огромные пустые зоны: секции плотные, вертикальные отступы умеренные (примерно 64–96px).",
    "Анимации только короткие fade/slide при появлении; без бесконечного «парения» карточек.",
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
  "gemini-3.1-flash-image",
  "gpt-image-2",
] as const;
export const WIZARD_STORAGE_KEY = "wc-wizard-v2";

export function nicheOptions() {
  return SITE_TEMPLATES.map((t) => ({ id: t.id, label: t.name }));
}

export function sectionOptions() {
  return SITE_SECTION_OPTIONS.map((s) => ({ id: s.id, label: s.label }));
}
