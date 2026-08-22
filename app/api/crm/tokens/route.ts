import { NextResponse } from "next/server";
import { isCrmAuthenticated } from "@/lib/crmAuth";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { creditTokens, getOrCreateBillingProfile } from "@/lib/billing";
import { recordEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  if (!(await isCrmAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      tokens?: number;
      reason?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const tokens = Math.trunc(Number(body.tokens));
    const reason = body.reason?.trim().slice(0, 200) || "Корректировка CRM";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Укажите email" }, { status: 400 });
    }
    if (!tokens || tokens === 0) {
      return NextResponse.json({ error: "Укажите количество токенов" }, { status: 400 });
    }
    if (Math.abs(tokens) > 1_000_000) {
      return NextResponse.json({ error: "Слишком большое значение" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: profileRow, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, token_balance")
      .ilike("email", email)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profileRow?.id) {
      return NextResponse.json(
        { error: "Пользователь с таким email не найден" },
        { status: 404 }
      );
    }

    const profile = await getOrCreateBillingProfile(admin, {
      id: profileRow.id,
      email: profileRow.email,
    });

    let newBalance: number;
    if (tokens > 0) {
      newBalance = await creditTokens(admin, profileRow.id, tokens, {
        type: "bonus",
        description: `CRM: ${reason} (+${tokens})`,
      });
    } else {
      const abs = Math.abs(tokens);
      const current = profile.token_balance ?? 0;
      if (current < abs) {
        return NextResponse.json(
          { error: `Недостаточно токенов на балансе (${current})` },
          { status: 400 }
        );
      }
      const next = current - abs;
      const { error: updErr } = await admin
        .from("profiles")
        .update({ token_balance: next })
        .eq("id", profileRow.id);
      if (updErr) throw updErr;
      await admin.from("transactions").insert({
        user_id: profileRow.id,
        amount: 0,
        tokens: -abs,
        type: "bonus",
        description: `CRM: ${reason} (−${abs})`,
      });
      newBalance = next;
    }

    void recordEvent({
      sessionId: "crm-admin",
      eventName: tokens > 0 ? "crm_tokens_add" : "crm_tokens_remove",
      eventLabel: email,
      userId: profileRow.id,
      userEmail: email,
      properties: { tokens, reason, newBalance },
    });

    return NextResponse.json({
      ok: true,
      email,
      tokenBalance: newBalance,
      delta: tokens,
    });
  } catch (error) {
    console.error("crm tokens:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 500 }
    );
  }
}
