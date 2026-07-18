import { NextResponse } from "next/server";
import {
  buildStatusPayload,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { createAdminClient, createUserClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createUserClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, user);
    return NextResponse.json(buildStatusPayload(profile));
  } catch (error) {
    console.error("user status error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
