import { NextResponse } from "next/server";
import {
  createCrmToken,
  crmCookieOptions,
  CRM_COOKIE,
  verifyCrmLogin,
} from "@/lib/crmAuth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!verifyCrmLogin(username, password)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(CRM_COOKIE, createCrmToken(), crmCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}
