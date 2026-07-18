export function parseSiteJson(content: string): {
  html: string;
  css: string;
  js: string;
} {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Модель не вернула JSON-объект");
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      html?: string;
      css?: string;
      js?: string;
    };
    if (!parsed.html) throw new Error("Нет поля html");
    return {
      html: parsed.html,
      css: parsed.css ?? "",
      js: parsed.js ?? "",
    };
  } catch {
    // fallback: вытащить html из обрезанного JSON
    const htmlMatch = cleaned.match(/"html"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (htmlMatch?.[1]) {
      const html = JSON.parse(`"${htmlMatch[1]}"`) as string;
      return { html, css: "", js: "" };
    }
    throw new Error("Модель не вернула JSON-объект");
  }
}
