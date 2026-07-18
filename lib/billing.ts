import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBrandColors } from "@/lib/brand";
import { parseSocials } from "@/lib/contacts";
import { FREE_TOKENS } from "@/lib/tokenConfig";

export type Tier = "starter" | "pro" | "agency";

export type ProfileBilling = {
  id: string;
  email: string | null;
  tier: Tier;
  tier_expires_at: string | null;
  token_balance: number;
  total_tokens_used: number;
  free_tokens_claimed: boolean;
  brand_logo?: string | null;
  brand_colors?: string[] | null;
  phone?: string | null;
  socials?: string[];
  show_contacts?: boolean;
  /** профиль без колонок токенов */
  legacyMode?: boolean;
};

const TOKEN_SELECT =
  "id, email, tier, tier_expires_at, token_balance, total_tokens_used, free_tokens_claimed";

const BRAND_SELECT = "brand_logo, brand_colors";
const CONTACTS_SELECT = "phone, socials, show_contacts";

const FULL_SELECT = `${TOKEN_SELECT}, ${BRAND_SELECT}, ${CONTACTS_SELECT}`;

const CORE_SELECT = "id, email, tier, tier_expires_at";

type ProfileRowResult = {
  data: Record<string, unknown> | null;
  hasTokens: boolean;
};

async function loadProfileRow(
  admin: SupabaseClient,
  userId: string
): Promise<ProfileRowResult> {
  const full = await admin
    .from("profiles")
    .select(FULL_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (!full.error && full.data) {
    return { data: full.data as Record<string, unknown>, hasTokens: true };
  }

  if (full.error && !isMissingColumnError(full.error)) {
    throw full.error;
  }

  // Без contacts: пробуем tokens+brand
  const withBrand = await admin
    .from("profiles")
    .select(`${TOKEN_SELECT}, ${BRAND_SELECT}`)
    .eq("id", userId)
    .maybeSingle();

  if (!withBrand.error && withBrand.data) {
    return {
      data: withBrand.data as Record<string, unknown>,
      hasTokens: true,
    };
  }

  const token = await admin
    .from("profiles")
    .select(TOKEN_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (!token.error && token.data) {
    return { data: token.data as Record<string, unknown>, hasTokens: true };
  }

  if (token.error && !isMissingColumnError(token.error)) {
    throw token.error;
  }

  const core = await admin
    .from("profiles")
    .select(CORE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (core.error) throw core.error;

  return {
    data: (core.data as Record<string, unknown> | null) ?? null,
    hasTokens: false,
  };
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST204" ||
    Boolean(err.message?.includes("Could not find the")) ||
    Boolean(err.message?.includes("column"))
  );
}

export function formatBillingError(error: unknown): string {
  if (!error) return "Неизвестная ошибка";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function normalizeTier(value: unknown): Tier {
  if (value === "pro" || value === "agency" || value === "starter") {
    return value;
  }
  return "starter";
}

function fromRow(row: Record<string, unknown>): ProfileBilling {
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    tier: normalizeTier(row.tier),
    tier_expires_at: (row.tier_expires_at as string | null) ?? null,
    token_balance: Number(row.token_balance ?? 0),
    total_tokens_used: Number(row.total_tokens_used ?? 0),
    free_tokens_claimed: Boolean(row.free_tokens_claimed),
    brand_logo:
      typeof row.brand_logo === "string" && row.brand_logo.trim()
        ? row.brand_logo.trim()
        : null,
    brand_colors:
      row.brand_colors != null ? parseBrandColors(row.brand_colors) : null,
    phone:
      typeof row.phone === "string" && row.phone.trim()
        ? row.phone.trim()
        : null,
    socials: parseSocials(row.socials),
    show_contacts: row.show_contacts !== false,
    legacyMode: row.token_balance === undefined,
  };
}

export function buildStatusPayload(profile: ProfileBilling) {
  const tier = normalizeTier(profile.tier);
  return {
    email: profile.email,
    tier,
    tierLabel: tier === "agency" ? "Agency" : tier === "pro" ? "Pro" : "Starter",
    tier_expires_at: profile.tier_expires_at,
    token_balance: profile.token_balance ?? 0,
    total_tokens_used: profile.total_tokens_used ?? 0,
    free_tokens_claimed: Boolean(profile.free_tokens_claimed),
    remaining: profile.token_balance ?? 0,
    remainingImages: profile.token_balance ?? 0,
    remainingChat: profile.token_balance ?? 0,
    isUnlimited: false,
    legacyMode: Boolean(profile.legacyMode),
    brand_logo: profile.brand_logo ?? null,
    brand_colors: profile.brand_colors ?? null,
    phone: profile.phone ?? "",
    socials: profile.socials ?? [],
    show_contacts: profile.show_contacts !== false,
  };
}

export type TokenSpendResult = {
  balance: number;
  totalUsed: number;
  charged: number;
};

/** Проверка баланса; при нехватке кидает Error с кодом-подобным сообщением */
export function assertHasTokens(
  profile: ProfileBilling,
  cost: number
): void {
  const balance = profile.token_balance ?? 0;
  if (balance < cost) {
    const err = new Error("Недостаточно токенов. Пополните баланс.");
    (err as Error & { status?: number }).status = 402;
    throw err;
  }
}

export async function chargeTokens(
  admin: SupabaseClient,
  profile: ProfileBilling,
  cost: number,
  meta?: { modelId?: string; description?: string }
): Promise<TokenSpendResult> {
  if (cost <= 0) {
    return {
      balance: profile.token_balance ?? 0,
      totalUsed: profile.total_tokens_used ?? 0,
      charged: 0,
    };
  }

  assertHasTokens(profile, cost);

  const nextBalance = (profile.token_balance ?? 0) - cost;
  const nextUsed = (profile.total_tokens_used ?? 0) + cost;

  const { error } = await admin
    .from("profiles")
    .update({
      token_balance: nextBalance,
      total_tokens_used: nextUsed,
    })
    .eq("id", profile.id);

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        "Выполните supabase/migrate-tokens.sql в Supabase (колонки токенов)"
      );
    }
    throw error;
  }

  const { error: txError } = await admin.from("transactions").insert({
    user_id: profile.id,
    amount: 0,
    tokens: -cost,
    type: "spend",
    model_id: meta?.modelId ?? null,
    description: meta?.description ?? `Списание ${cost} ток.`,
  });

  if (txError && !isMissingColumnError(txError)) {
    console.error("transaction spend log error:", txError);
  }

  return { balance: nextBalance, totalUsed: nextUsed, charged: cost };
}

export async function creditTokens(
  admin: SupabaseClient,
  userId: string,
  tokens: number,
  meta?: {
    amount?: number;
    type?: "purchase" | "bonus" | "refund";
    description?: string;
    yookassaPaymentId?: string;
  }
): Promise<number> {
  if (tokens <= 0) {
    const { data } = await admin
      .from("profiles")
      .select("token_balance")
      .eq("id", userId)
      .maybeSingle();
    return Number(data?.token_balance ?? 0);
  }

  const { data: row, error: readError } = await admin
    .from("profiles")
    .select("token_balance")
    .eq("id", userId)
    .maybeSingle();

  if (readError) throw readError;

  const current = Number(row?.token_balance ?? 0);
  const next = current + tokens;

  const { error } = await admin
    .from("profiles")
    .update({ token_balance: next })
    .eq("id", userId);

  if (error) throw error;

  await admin.from("transactions").insert({
    user_id: userId,
    amount: meta?.amount ?? 0,
    tokens,
    type: meta?.type ?? "purchase",
    description: meta?.description ?? `Пополнение +${tokens}`,
    yookassa_payment_id: meta?.yookassaPaymentId ?? null,
  });

  return next;
}

/** Начислить FREE_TOKENS один раз */
export async function ensureFreeTokens(
  admin: SupabaseClient,
  profile: ProfileBilling
): Promise<ProfileBilling> {
  if (profile.free_tokens_claimed) return profile;

  const nextBalance = (profile.token_balance ?? 0) + FREE_TOKENS;
  const { error } = await admin
    .from("profiles")
    .update({
      token_balance: nextBalance,
      free_tokens_claimed: true,
    })
    .eq("id", profile.id);

  if (error) {
    if (isMissingColumnError(error)) return { ...profile, legacyMode: true };
    console.error("ensureFreeTokens error:", error);
    return profile;
  }

  await admin.from("transactions").insert({
    user_id: profile.id,
    amount: 0,
    tokens: FREE_TOKENS,
    type: "bonus",
    description: "Бесплатные токены при регистрации",
  });

  return {
    ...profile,
    token_balance: nextBalance,
    free_tokens_claimed: true,
  };
}

export async function getOrCreateBillingProfile(
  admin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<ProfileBilling> {
  const loaded = await loadProfileRow(admin, user.id);

  if (loaded.data) {
    let profile = fromRow(loaded.data);
    if (!loaded.hasTokens) {
      profile = {
        ...profile,
        token_balance: 0,
        total_tokens_used: 0,
        free_tokens_claimed: false,
        legacyMode: true,
      };
    }
    profile = await ensureFreeTokens(admin, profile);
    return profile;
  }

  const created = await admin
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      tier: "starter",
      token_balance: FREE_TOKENS,
      total_tokens_used: 0,
      free_tokens_claimed: true,
      subscription_status: "trial",
    })
    .select(FULL_SELECT)
    .single();

  if (!created.error && created.data) {
    await admin.from("transactions").insert({
      user_id: user.id,
      amount: 0,
      tokens: FREE_TOKENS,
      type: "bonus",
      description: "Бесплатные токены при регистрации",
    });
    return fromRow(created.data as Record<string, unknown>);
  }

  if (created.error && isMissingColumnError(created.error)) {
    const fallback = await admin
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        tier: "starter",
        subscription_status: "trial",
      })
      .select(CORE_SELECT)
      .single();

    if (fallback.error || !fallback.data) {
      throw fallback.error ?? new Error("Не удалось создать профиль");
    }

    return {
      ...fromRow(fallback.data as Record<string, unknown>),
      token_balance: 0,
      total_tokens_used: 0,
      free_tokens_claimed: false,
      legacyMode: true,
    };
  }

  throw created.error ?? new Error("Не удалось создать профиль");
}
