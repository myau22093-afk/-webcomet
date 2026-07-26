/**
 * Партнёрские офферы: домен + хостинг через посредников.
 * Подставь свои affiliate-ссылки в NEXT_PUBLIC_AFFILIATE_* — комиссия идёт тебе.
 */
export type HostingPartner = {
  id: string;
  name: string;
  blurb: string;
  href: string;
  badge?: string;
};

function envLink(key: string, fallback: string): string {
  if (typeof process === "undefined") return fallback;
  const v = process.env[key]?.trim();
  return v || fallback;
}

export function getHostingPartners(): HostingPartner[] {
  return [
    {
      id: "regru",
      name: "Рег.ру",
      blurb: "Домен .ru + хостинг — привычный вариант для РФ",
      href: envLink(
        "NEXT_PUBLIC_AFFILIATE_REGRU",
        "https://www.reg.ru/?utm_source=webcomet&utm_medium=affiliate"
      ),
      badge: "Популярно",
    },
    {
      id: "beget",
      name: "Beget",
      blurb: "Простой хостинг, удобная панель, быстрый старт",
      href: envLink(
        "NEXT_PUBLIC_AFFILIATE_BEGET",
        "https://beget.com/?utm_source=webcomet&utm_medium=affiliate"
      ),
    },
    {
      id: "timeweb",
      name: "Timeweb",
      blurb: "Хостинг и VPS — если сайт вырастет",
      href: envLink(
        "NEXT_PUBLIC_AFFILIATE_TIMEWEB",
        "https://timeweb.com/?utm_source=webcomet&utm_medium=affiliate"
      ),
    },
  ];
}

/** Пакеты «под ключ» — ты как посредник (оплата позже через ЮKassa) */
export const HOSTING_ASSIST_PACKAGES = [
  {
    id: "domain",
    title: "Домен",
    priceLabel: "от 199 ₽/год",
    description: "Подберём и зарегистрируем домен (.ru / .com) на тебя.",
  },
  {
    id: "hosting",
    title: "Хостинг",
    priceLabel: "от 149 ₽/мес",
    description: "Зальём сайт на хостинг, настроим HTTPS и почту.",
  },
  {
    id: "turnkey",
    title: "Под ключ",
    priceLabel: "от 1 990 ₽",
    description: "Домен + хостинг + заливка твоего сайта с WebComet.",
  },
] as const;
