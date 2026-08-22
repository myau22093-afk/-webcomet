import { NextResponse } from "next/server";
import { CRM_COOKIE, crmCookieOptions } from "@/lib/crmAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CRM_COOKIE, "", { ...crmCookieOptions(), maxAge: 0 });
  return res;
}
