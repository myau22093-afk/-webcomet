/** Понятные русские тексты вместо сырых ошибок Promptra / OpenAI */
export function humanizeUpstreamError(
  raw: unknown,
  fallback = "Ошибка запроса к модели"
): string {
  const text =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object"
        ? String(
            (raw as { message?: string; error?: { message?: string } }).error
              ?.message ??
              (raw as { message?: string }).message ??
              ""
          )
        : "";

  const lower = text.toLowerCase();

  if (
    lower.includes("safety system") ||
    lower.includes("rejected by the safety") ||
    lower.includes("content_policy") ||
    lower.includes("content policy") ||
    lower.includes("moderation") ||
    lower.includes("unsafe")
  ) {
    return [
      "Запрос отклонён фильтром безопасности.",
      "Чаще всего так бывает из‑за чужих персонажей (Марио, Человек‑паук и т.п.), брендов, логотипов, знаменитостей или NSFW.",
      "Переформулируй промпт своими словами, без имён брендов и персонажей.",
    ].join(" ");
  }

  if (lower.includes("model is not available") || lower.includes("not available")) {
    return "Эта модель сейчас недоступна. Выберите другую в списке.";
  }

  if (
    lower.includes("connect timeout") ||
    lower.includes("timeout") ||
    lower.includes("оборвал соединение") ||
    lower.includes("fetch failed")
  ) {
    return "Сервис не ответил вовремя. Попробуйте ещё раз через минуту.";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Слишком много запросов. Подождите немного и повторите.";
  }

  if (lower.includes("insufficient") || lower.includes("quota") || lower.includes("billing")) {
    return "Сервис временно недоступен. Попробуйте позже или другую модель.";
  }

  // Не отдаём сырой техтекст клиенту
  if (text.trim()) {
    return "Не удалось выполнить запрос. Попробуйте ещё раз или смените модель.";
  }
  return fallback;
}
