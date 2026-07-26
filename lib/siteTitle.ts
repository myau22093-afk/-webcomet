/** Короткий человекочитаемый заголовок для истории сайтов */
export function shortSiteTitle(raw: string, max = 52): string {
  const text = (raw || "").trim().replace(/\s+/g, " ");
  if (!text) return "Сайт";

  const topic = text.match(/Тема\s*\/\s*бизнес:\s*(.+?)(?:\n|$)/i);
  if (topic?.[1]) return clamp(topic[1].trim(), max);

  let cleaned = text
    .replace(/^\[edit\]\s*/i, "")
    .replace(/^Создай современный лендинг\.?\s*/i, "")
    .replace(/^Тема\s*\/\s*бизнес:\s*/i, "")
    .trim();

  const firstLine = cleaned.split(/\n/)[0]?.trim() || cleaned;
  return clamp(firstLine || "Сайт", max);
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
