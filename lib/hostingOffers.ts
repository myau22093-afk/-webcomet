/**
 * Партнёрка Рег.ру (бонусная программа).
 * Переопределение: NEXT_PUBLIC_AFFILIATE_REGRU / _DOMAIN / _HOSTING
 */
export type HostingPartner = {
  id: string;
  name: string;
  blurb: string;
  href: string;
  badge?: string;
};

const REGRU_RLINK = "rlink=reflink-32113679";

function envLink(key: string, fallback: string): string {
  if (typeof process === "undefined") return fallback;
  const v = process.env[key]?.trim();
  return v || fallback;
}

/** Главная Рег.ру с твоим реф-кодом */
export function regruHomeUrl(): string {
  return envLink(
    "NEXT_PUBLIC_AFFILIATE_REGRU",
    `https://www.reg.ru/?${REGRU_RLINK}`
  );
}

export function regruDomainUrl(): string {
  return envLink(
    "NEXT_PUBLIC_AFFILIATE_REGRU_DOMAIN",
    `https://www.reg.ru/domain/new/?${REGRU_RLINK}`
  );
}

export function regruHostingUrl(): string {
  return envLink(
    "NEXT_PUBLIC_AFFILIATE_REGRU_HOSTING",
    `https://www.reg.ru/hosting/?${REGRU_RLINK}`
  );
}

export function getHostingPartners(): HostingPartner[] {
  return [
    {
      id: "regru-domain",
      name: "Домен на Рег.ру",
      blurb: "Зарегистрировать .ru / .com",
      href: regruDomainUrl(),
      badge: "Домен",
    },
    {
      id: "regru-hosting",
      name: "Хостинг на Рег.ру",
      blurb: "Заказать хостинг и залить сайт",
      href: regruHostingUrl(),
      badge: "Хостинг",
    },
    {
      id: "regru",
      name: "Рег.ру — всё сразу",
      blurb: "Главная: домены, хостинг, облако",
      href: regruHomeUrl(),
    },
  ];
}

/** Пакеты «под ключ» — заявка тебе + быстрый переход на Рег.ру */
export const HOSTING_ASSIST_PACKAGES = [
  {
    id: "domain",
    title: "Домен",
    priceLabel: "от 199 ₽/год",
    description: "Подберём и зарегистрируем домен (.ru / .com).",
    partnerHrefKey: "domain" as const,
  },
  {
    id: "hosting",
    title: "Хостинг",
    priceLabel: "от 149 ₽/мес",
    description: "Хостинг под твой сайт с WebComet.",
    partnerHrefKey: "hosting" as const,
  },
  {
    id: "turnkey",
    title: "Под ключ",
    priceLabel: "от 1 990 ₽",
    description: "Домен + хостинг + заливка — напиши нам, сделаем.",
    partnerHrefKey: "home" as const,
  },
] as const;

export function assistPackageHref(
  key: (typeof HOSTING_ASSIST_PACKAGES)[number]["partnerHrefKey"]
): string {
  if (key === "domain") return regruDomainUrl();
  if (key === "hosting") return regruHostingUrl();
  return regruHomeUrl();
}
