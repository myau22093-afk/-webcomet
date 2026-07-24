import { NextResponse } from "next/server";
import {
  buildStatusPayload,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { normalizeContacts } from "@/lib/contacts";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      phone?: unknown;
      email?: unknown;
      socials?: unknown;
      show_contacts?: unknown;
    };

    const contacts = normalizeContacts(body);
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({
        phone: contacts.phone || null,
        email: contacts.email || auth.user.email || null,
        socials: contacts.socials,
        show_contacts: contacts.show_contacts,
      })
      .eq("id", auth.user.id);

    if (error) {
      console.error("update-contacts error:", error);
      const missing =
        error.message?.includes("phone") ||
        error.message?.includes("socials") ||
        error.message?.includes("show_contacts") ||
        error.code === "PGRST204";
      return NextResponse.json(
        {
          error: missing
            ? "Не удалось сохранить контакты. Попробуйте позже."
            : formatBillingError(error),
        },
        { status: 500 }
      );
    }

    const profile = await getOrCreateBillingProfile(admin, auth.user);
    return NextResponse.json({
      ok: true,
      ...buildStatusPayload(profile),
      contacts: {
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        socials: profile.socials ?? [],
        show_contacts: profile.show_contacts !== false,
      },
    });
  } catch (error) {
    console.error("update-contacts API error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) },
      { status: 500 }
    );
  }
}
