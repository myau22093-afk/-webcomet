/** Удаляет из HTML обрывки, похожие на OCR-текст со скриншота-референса */
export function stripLikelyOcrScraps(html: string): string {
  if (!html.trim()) return html;

  return html.replace(/>([^<]+)</g, (full, raw: string) => {
    const text = raw;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) return full;

    let score = 0;
    if (trimmed.includes("\uFFFD")) score += 3;
    if (/[А-Яа-яA-Za-z]{2,}[.…·•]{1,}[А-Яа-яA-Za-z]/.test(trimmed)) score += 3;
    if (
      /[А-Яа-я][A-Za-z]|[A-Za-z][А-Яа-я]/.test(trimmed) &&
      trimmed.length < 64
    ) {
      score += 2;
    }
    if ((trimmed.match(/[|¦•·▪▫□■◆◇]/g) || []).length >= 1) score += 2;
    if (/[а-яё][А-ЯЁ]/.test(trimmed)) score += 1;
    if (/[А-Яа-яA-Za-z]{1,3}[-‑–—|][А-Яа-яA-Za-z]{1,3}/.test(trimmed)) {
      score += 2;
    }
    const junkTokens = (trimmed.match(/\b[\wа-яё]{1,2}\b/gi) || []).length;
    const words = (trimmed.match(/\S+/g) || []).length;
    if (words >= 3 && junkTokens / words > 0.45) score += 2;
    if (
      /^(Menu|Home|Log\s?in|Sign\s?up|Skip|Cookie|Accept|Закрыть|Меню)\b/i.test(
        trimmed
      ) &&
      trimmed.length < 24
    ) {
      score += 2;
    }
    // обрывки слов: короткие «части» с троеточием или pipe
    if (/[.…|]/.test(trimmed) && trimmed.length < 28) score += 2;

    if (score < 2) return full;

    console.warn(
      "[generate-site] stripped OCR-like scrap:",
      trimmed.slice(0, 80)
    );
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    return `>${leading}${trailing}<`;
  });
}
