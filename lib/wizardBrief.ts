import {
  SITE_SECTION_OPTIONS,
  type SiteSectionId,
  defaultSections,
} from "@/lib/brand";
import { SITE_TEMPLATES, getTemplateById } from "@/lib/siteTemplates";

export type WizardPalette = {
  id: string;
  label: string;
  colors: string[];
};

export const WIZARD_PALETTES: WizardPalette[] = [
  {
    id: "violet",
    label: "Фиолетовый акцент",
    colors: ["#6c3bf4", "#ffffff", "#0b0f19"],
  },
  {
    id: "ocean",
    label: "Океан",
    colors: ["#0ea5e9", "#f0f9ff", "#0c4a6e"],
  },
  {
    id: "forest",
    label: "Зелень",
    colors: ["#16a34a", "#f0fdf4", "#14532d"],
  },
  {
    id: "sunset",
    label: "Тёплый",
    colors: ["#ea580c", "#fff7ed", "#1c1917"],
  },
  {
    id: "mono",
    label: "Монохром",
    colors: ["#e4e4e7", "#fafafa", "#09090b"],
  },
];

export type WizardBrief = {
  topic: string;
  notes: string;
  paletteId: string | null;
  colors: string[];
  sections: SiteSectionId[];
  nicheId: string | null;
};

export type WizardUiStep =
  | "topic"
  | "palette"
  | "sections"
  | "niche"
  | "ready";

export function emptyWizardBrief(): WizardBrief {
  return {
    topic: "",
    notes: "",
    paletteId: null,
    colors: [...WIZARD_PALETTES[0].colors],
    sections: defaultSections(),
    nicheId: null,
  };
}

export function isBriefReady(brief: WizardBrief): boolean {
  return (
    brief.topic.trim().length >= 3 &&
    brief.colors.length >= 2 &&
    brief.sections.length >= 2
  );
}

export function nextScriptedStep(brief: WizardBrief): WizardUiStep | null {
  if (!brief.topic.trim() || brief.topic.trim().length < 3) return "topic";
  if (!brief.paletteId) return "palette";
  if (brief.sections.length < 2) return "sections";
  return "ready";
}

export function buildWizardSitePrompt(brief: WizardBrief): {
  prompt: string;
  customRequirements: string;
  brandColors: string[];
  sections: SiteSectionId[];
  nicheName: string | null;
  templateId: string | null;
} {
  const niche = brief.nicheId ? getTemplateById(brief.nicheId) : null;
  const sectionLabels = SITE_SECTION_OPTIONS.filter((s) =>
    brief.sections.includes(s.id)
  )
    .map((s) => s.label)
    .join(", ");

  const prompt = [
    `Создай современный лендинг.`,
    `Тема / бизнес: ${brief.topic.trim()}`,
    niche ? `Ниша: ${niche.name}` : null,
    `Секции сайта: ${sectionLabels}`,
    `Цвета бренда: ${brief.colors.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const customRequirements = [
    brief.notes.trim() || null,
    "Сделай законченный продающий лендинг на русском.",
    "Кнопки и якорные ссылки должны работать.",
    "В hero и блоке услуг оставь места под изображения (пустые блоки или img с data-wc-slot).",
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
  };
}

export const WIZARD_SITE_MODEL_ID = "gpt-5.6-sol";
export const WIZARD_CHAT_MODEL_ID = "deepseek-chat";
export const WIZARD_IMAGE_MODEL_ID = "gemini-3.1-flash-image";

export function nicheOptions() {
  return SITE_TEMPLATES.map((t) => ({ id: t.id, label: t.name }));
}

export function sectionOptions() {
  return SITE_SECTION_OPTIONS.map((s) => ({ id: s.id, label: s.label }));
}
