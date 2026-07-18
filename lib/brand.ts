export const DEFAULT_BRAND_COLORS = [
  "#6c3bf4",
  "#ffffff",
  "#0b0f19",
  "#a78bfa",
  "#22d3ee",
  "#f472b6",
] as const;

export const SITE_SECTION_OPTIONS = [
  { id: "hero", label: "Hero" },
  { id: "services", label: "Услуги" },
  { id: "reviews", label: "Отзывы" },
  { id: "form", label: "Форма" },
  { id: "map", label: "Карта" },
  { id: "footer", label: "Футер" },
] as const;

export type SiteSectionId = (typeof SITE_SECTION_OPTIONS)[number]["id"];

export type PreviewDevice = "phone" | "tablet" | "desktop";

export const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number | null> = {
  phone: 375,
  tablet: 768,
  desktop: null,
};

export const EXPRESS_SITE_MODEL_IDS = [
  "claude-fable-5",
  "gpt-5.6-sol",
] as const;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHexColor(value: string, fallback: string): string {
  const raw = value.trim();
  if (!isValidHexColor(raw)) return fallback;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

export function normalizeBrandColors(
  input: unknown,
  length = 6
): string[] {
  const defaults = [...DEFAULT_BRAND_COLORS];
  if (!Array.isArray(input)) return defaults.slice(0, length);
  const out: string[] = [];
  for (let i = 0; i < length; i++) {
    const raw = typeof input[i] === "string" ? input[i] : "";
    out.push(normalizeHexColor(raw, defaults[i] ?? defaults[0]));
  }
  return out;
}

export function parseBrandColors(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return normalizeBrandColors(JSON.parse(value));
    } catch {
      return [...DEFAULT_BRAND_COLORS];
    }
  }
  return normalizeBrandColors(value);
}

export const LOGO_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/svg+xml,.png,.jpg,.jpeg,.svg";

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export function validateLogoFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const okType =
    type === "image/png" ||
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/svg+xml" ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".svg");
  if (!okType) return "Логотип: только PNG, JPG или SVG";
  if (file.size > LOGO_MAX_BYTES) return "Логотип не больше 5 MB";
  return null;
}

export function defaultSections(): SiteSectionId[] {
  return SITE_SECTION_OPTIONS.map((s) => s.id);
}

export function sectionLabels(ids: string[]): string[] {
  const map = new Map(SITE_SECTION_OPTIONS.map((s) => [s.id, s.label]));
  return ids
    .map((id) => map.get(id as SiteSectionId) ?? id)
    .filter(Boolean);
}
