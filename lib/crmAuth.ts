import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const CRM_COOKIE = "wc-crm-auth";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function crmCredentials(): { username: string; password: string } {
  return {
    username: process.env.CRM_USERNAME?.trim() || "crmVASYA1337",
    password: process.env.CRM_PASSWORD?.trim() || "taTIchoVASYA",
  };
}

function crmSecret(): string {
  return (
    process.env.CRM_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "wc-crm-dev-secret-change-me"
  );
}

export function verifyCrmLogin(username: string, password: string): boolean {
  const creds = crmCredentials();
  return username === creds.username && password === creds.password;
}

export function createCrmToken(): string {
  const exp = Date.now() + SESSION_MS;
  const payload = `${exp}`;
  const sig = createHmac("sha256", crmSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyCrmToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", crmSecret())
    .update(payload)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isCrmAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifyCrmToken(jar.get(CRM_COOKIE)?.value);
}

export function crmCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
  };
}
