/** Тарифы публикации сайта на *.webcomet.ru */

export type PublishPackageId =
  | "m1"
  | "m3"
  | "m6"
  | "y1"
  | "y2";

export type PublishPackage = {
  id: PublishPackageId;
  label: string;
  months: number;
  price: number;
};

export const PUBLISH_PACKAGES: PublishPackage[] = [
  { id: "m1", label: "1 месяц", months: 1, price: 199 },
  { id: "m3", label: "3 месяца", months: 3, price: 499 },
  { id: "m6", label: "6 месяцев", months: 6, price: 899 },
  { id: "y1", label: "1 год", months: 12, price: 1490 },
  { id: "y2", label: "2 года", months: 24, price: 2490 },
];

export function getPublishPackage(
  id: string | null | undefined
): PublishPackage | null {
  if (!id) return null;
  return PUBLISH_PACKAGES.find((p) => p.id === id) ?? null;
}

export function publishBaseDomain(): string {
  return (
    process.env.NEXT_PUBLIC_PUBLISH_BASE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").replace(
      /\/$/,
      ""
    ) ||
    "webcomet.ru"
  )
    .replace(/^www\./, "")
    .toLowerCase();
}

export function publishPublicUrl(slug: string): string {
  const base = publishBaseDomain();
  return `https://${slug}.${base}`;
}

/** Запасной URL без wildcard DNS */
export function publishPathUrl(slug: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `https://${publishBaseDomain()}`;
  return `${origin}/s/${slug}`;
}
