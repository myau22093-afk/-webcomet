import { NextResponse } from "next/server";
import {
  buildStatusPayload,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { formatTokens } from "@/lib/tokenConfig";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const status = buildStatusPayload(profile);

    const { data: history, error } = await admin
      .from("transactions")
      .select(
        "id, amount, tokens, type, model_id, description, yookassa_payment_id, created_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("balance history error:", error);
    }

    return NextResponse.json({
      token_balance: status.token_balance,
      total_tokens_used: status.total_tokens_used,
      free_tokens_claimed: status.free_tokens_claimed,
      balanceLabel: `${formatTokens(status.token_balance)} токенов`,
      history: history ?? [],
    });
  } catch (error) {
    console.error("balance API error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
