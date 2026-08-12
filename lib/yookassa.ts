/** IP-диапазоны ЮKassa для входящих webhook (документация 2026). */
const YOOKASSA_IP_CIDRS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return null;
  }
  return (
    ((parts[0]! << 24) >>> 0) +
    ((parts[1]! << 16) >>> 0) +
    ((parts[2]! << 8) >>> 0) +
    (parts[3]! >>> 0)
  );
}

function matchCidr(ip: string, cidr: string): boolean {
  if (cidr.includes(":")) {
    return ip.includes(":") && ip.toLowerCase().startsWith(cidr.split("/")[0]!.slice(0, 8));
  }
  const [net, bitsStr] = cidr.split("/");
  const bits = Number.parseInt(bitsStr ?? "32", 10);
  const ipInt = ipToInt(ip);
  const netInt = ipToInt(net ?? "");
  if (ipInt == null || netInt == null || !Number.isFinite(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function isYooKassaIp(ip: string): boolean {
  const host = ip.replace(/^::ffff:/, "").trim();
  if (!host) return false;
  if (host === "77.75.156.11" || host === "77.75.156.35") return true;
  return YOOKASSA_IP_CIDRS.some((cidr) => matchCidr(host, cidr));
}

export function yookassaAuthHeader(): string | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secret) return null;
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
}

export type YooPaymentStatus = {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value?: string; currency?: string };
  metadata?: Record<string, string>;
};

/** Подтверждаем платёж через API ЮKassa (защита от поддельных webhook). */
export async function fetchYooKassaPayment(
  paymentId: string
): Promise<YooPaymentStatus | null> {
  const auth = yookassaAuthHeader();
  if (!auth) return null;
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: auth },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as YooPaymentStatus;
}
