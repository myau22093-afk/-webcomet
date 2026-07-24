/** Списание токенов за запрос (калибровка под маржу >=50% при ~1 ₽/токен) */
export const TOKEN_COSTS: Record<string, { cost: number }> = {
  "claude-fable-5": { cost: 80 },
  "claude-sonnet-5": { cost: 35 },
  "gpt-5.6-sol": { cost: 55 },
  "gpt-5.6-terra": { cost: 28 },
  "gpt-5.6-luna": { cost: 14 },
  "gpt-5.6-luna-chat": { cost: 12 },
  "claude-sonnet-4-6": { cost: 30 },
  "gemini-3.1-flash-image": { cost: 35 },
  "gemini-3-pro-image": { cost: 55 },
  "gpt-image-2": { cost: 30 },
  "gemini-3.1-flash-lite": { cost: 4 },
  "deepseek-chat": { cost: 1 },
};

export const TOKEN_PACKAGES = [
  { id: "basic", tokens: 500, price: 500, label: "Basic" },
  { id: "pro", tokens: 2000, price: 1800, label: "Pro" },
  { id: "business", tokens: 5000, price: 4000, label: "Business" },
  { id: "enterprise", tokens: 20000, price: 14000, label: "Enterprise" },
] as const;

export type TokenPackageId = (typeof TOKEN_PACKAGES)[number]["id"];

export const FREE_TOKENS = 100;

export const DEFAULT_TOKEN_COST = 15;

/** Стоимость модели в токенах (по catalog id) */
export function getTokenCost(modelId: string | null | undefined): number {
  if (!modelId) return DEFAULT_TOKEN_COST;
  const direct = TOKEN_COSTS[modelId];
  if (direct) return direct.cost;

  // aliases
  if (modelId.includes("fable")) return TOKEN_COSTS["claude-fable-5"].cost;
  if (modelId.includes("sonnet-5")) return TOKEN_COSTS["claude-sonnet-5"].cost;
  if (modelId.includes("sonnet")) return TOKEN_COSTS["claude-sonnet-4-6"].cost;
  if (modelId.includes("gpt-5.6-sol") || modelId.includes("sol"))
    return TOKEN_COSTS["gpt-5.6-sol"].cost;
  if (modelId.includes("terra")) return TOKEN_COSTS["gpt-5.6-terra"].cost;
  if (modelId.includes("luna")) return TOKEN_COSTS["gpt-5.6-luna"].cost;
  if (modelId.includes("gpt-image")) return TOKEN_COSTS["gpt-image-2"].cost;
  if (modelId.includes("flash-image"))
    return TOKEN_COSTS["gemini-3.1-flash-image"].cost;
  if (modelId.includes("pro-image"))
    return TOKEN_COSTS["gemini-3-pro-image"].cost;
  if (modelId.includes("deepseek")) return TOKEN_COSTS["deepseek-chat"].cost;
  if (modelId.includes("flash-lite") || modelId.includes("lite"))
    return TOKEN_COSTS["gemini-3.1-flash-lite"].cost;

  return DEFAULT_TOKEN_COST;
}

export function getTokenPackage(packageId: string) {
  return TOKEN_PACKAGES.find((p) => p.id === packageId) ?? null;
}

export function formatTokens(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString("ru-RU");
}
