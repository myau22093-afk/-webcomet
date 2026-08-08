/**
 * Публичный origin сайта для редиректов (подтверждение почты, OAuth, оплата).
 * Никогда не возвращает 0.0.0.0 / docker-hostname — иначе ссылки из писем ломаются.
 */
export function publicAppOrigin(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv && isSafePublicOrigin(fromEnv)) {
    return fromEnv;
  }

  if (request) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.trim() ||
      "";
    if (host && isSafePublicHost(host)) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
    try {
      const origin = new URL(request.url).origin;
      if (isSafePublicOrigin(origin)) return origin;
    } catch {
      /* ignore */
    }
  }

  return "https://webcomet.ru";
}

function isSafePublicHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h || h.startsWith("0.0.0.0")) return false;
  if (h.startsWith("127.0.0.1") || h.startsWith("localhost")) return false;
  if (h.includes("webcomet:") || h === "webcomet" || h.startsWith("webcomet:"))
    return false;
  return true;
}

function isSafePublicOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return isSafePublicHost(u.host);
  } catch {
    return false;
  }
}
