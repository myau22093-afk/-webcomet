import { createAdminClient } from "@/lib/supabaseAdmin";

export type ApiUsageLogInput = {
  userId?: string | null;
  route: string;
  modelId: string;
  modelLabel?: string;
  provider?: string | null;
  tokenCost: number;
  /** Оценка в USD (display), не биллинг провайдера */
  costUsd?: number;
  cached?: boolean;
  kind?: string;
  reason?: string;
  promptHash?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Логирует использование модели: console + таблица api_usage_logs (если есть).
 */
export async function logApiUsage(input: ApiUsageLogInput): Promise<void> {
  const line = [
    `[api-usage]`,
    `route=${input.route}`,
    `model=${input.modelId}`,
    `tokens=${input.tokenCost}`,
    `usd≈${input.costUsd ?? 0}`,
    `cached=${Boolean(input.cached)}`,
    input.kind ? `kind=${input.kind}` : null,
    input.reason ? `reason=${input.reason}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(line);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("api_usage_logs").insert({
      user_id: input.userId ?? null,
      route: input.route,
      model_id: input.modelId,
      model_label: input.modelLabel ?? null,
      provider: input.provider ?? null,
      token_cost: input.tokenCost,
      cost_usd: input.costUsd ?? 0,
      cached: Boolean(input.cached),
      kind: input.kind ?? null,
      reason: input.reason ?? null,
      prompt_hash: input.promptHash ?? null,
      meta: input.meta ?? {},
    });
    if (error && !/does not exist|relation|42P01/i.test(error.message ?? "")) {
      console.error("logApiUsage insert error:", error);
    }
  } catch (error) {
    console.error("logApiUsage fatal:", error);
  }
}
