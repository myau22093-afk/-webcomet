export const SITE_STYLES = [
  {
    id: "minimalism",
    label: "Минимализм",
    guide:
      "белый, серый, чёрный; много воздуха и негативного пространства; тонкие линии; без лишнего декора; чистая типографика",
  },
  {
    id: "cyberpunk",
    label: "Киберпанк",
    guide:
      "неоновые цвета (розовый, синий, фиолетовый); глитч-эффекты; угловатые формы; тёмный фон; футуристичные акценты",
  },
  {
    id: "scandinavian",
    label: "Скандинавский",
    guide:
      "светлые тона (белый, бежевый, голубой); ощущение натуральных материалов; уютные шрифты; спокойные отступы",
  },
  {
    id: "luxury",
    label: "Роскошь",
    guide:
      "золотой, чёрный, белый; изящные serif-шрифты; декоративные элементы; премиальные тени и отступы",
  },
  {
    id: "eco",
    label: "Эко",
    guide:
      "зелёный, коричневый, бежевый; природные текстуры/паттерны; округлые формы; мягкая органика",
  },
] as const;

export type SiteStyleId = (typeof SITE_STYLES)[number]["id"];

export function resolveSiteStyle(value: unknown): (typeof SITE_STYLES)[number] {
  const found = SITE_STYLES.find((s) => s.id === value || s.label === value);
  return found ?? SITE_STYLES[0];
}
