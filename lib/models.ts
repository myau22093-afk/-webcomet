import { createHash } from "crypto";

export type QualityMode = "fast" | "quality";
export type ProviderId = "promptra" | "proxyapi";
export type ModelType = "site" | "image" | "chat";

export type ModelConfig = {
  id: string;
  name: string;
  provider: ProviderId;
  modelId: string;
  type: ModelType;
  costMultiplier: number;
  description?: string;
  /** Провайдеры для fallback (тот же modelId, если у провайдера есть ключ) */
  fallbackProviders?: ProviderId[];
};

export type ResolvedModelCredentials = {
  provider: ProviderId;
  modelId: string;
  baseURL: string;
  apiKey: string;
  config: ModelConfig;
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  promptra: "Promptra",
  proxyapi: "ProxyAPI",
};

/** Каталог моделей UI + API (порядок = от дорогих к дешёвым в селекте) */
export const MODEL_CATALOG: ModelConfig[] = [
  // —— Сайт (токены: 250 → 24) ——
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6",
    provider: "promptra",
    modelId: "moonshotai/kimi-k2.6",
    type: "site",
    costMultiplier: 1.35,
    description: "Опционально · сильный UI/код (тест)",
    fallbackProviders: ["proxyapi"],
  },
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    provider: "proxyapi",
    modelId: "anthropic/claude-fable-5",
    type: "site",
    costMultiplier: 1.4,
    description: "Премиум в Мастере · по умолчанию",
    fallbackProviders: ["promptra"],
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    provider: "proxyapi",
    modelId: "openai/gpt-5.6-sol",
    type: "site",
    costMultiplier: 1.5,
    description: "Сильное качество",
    fallbackProviders: ["promptra"],
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "proxyapi",
    modelId: "anthropic/claude-sonnet-5",
    type: "site",
    costMultiplier: 1.2,
    description: "Баланс цена / качество",
    fallbackProviders: ["promptra"],
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "promptra",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "site",
    costMultiplier: 1.0,
    description: "Классика",
    fallbackProviders: ["proxyapi"],
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    provider: "proxyapi",
    modelId: "openai/gpt-5.6-terra",
    type: "site",
    costMultiplier: 1.3,
    description: "Хорошее качество · средняя цена",
    fallbackProviders: ["promptra"],
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "proxyapi",
    modelId: "openai/gpt-5.6-luna",
    type: "site",
    costMultiplier: 1.1,
    description: "Быстрее / дешевле среди 5.6",
    fallbackProviders: ["promptra"],
  },

  // —— Картинки (токены: 95 → 55) ——
  {
    id: "gemini-3-pro-image",
    name: "Gemini Pro Image",
    provider: "proxyapi",
    modelId: "gemini/gemini-3-pro-image",
    type: "image",
    costMultiplier: 1.0,
    description: "Максимальное качество",
    fallbackProviders: ["promptra"],
  },
  {
    id: "gemini-3.1-flash-image",
    name: "Gemini Flash Image",
    provider: "proxyapi",
    modelId: "gemini/gemini-3.1-flash-image",
    type: "image",
    costMultiplier: 0.6,
    description: "По умолчанию · быстро",
    fallbackProviders: ["promptra"],
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    provider: "proxyapi",
    modelId: "openai/gpt-image-2",
    type: "image",
    costMultiplier: 1.0,
    description: "Стиль OpenAI",
    fallbackProviders: ["promptra"],
  },

  // —— Чат (токены: 18 → 2) ——
  {
    id: "gpt-5.6-luna-chat",
    name: "GPT-5.6 Luna",
    provider: "proxyapi",
    modelId: "openai/gpt-5.6-luna",
    type: "chat",
    costMultiplier: 0.35,
    description: "По умолчанию · умный ответ",
    fallbackProviders: ["promptra"],
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini Flash Lite",
    provider: "proxyapi",
    modelId: "gemini/gemini-3.1-flash-lite",
    type: "chat",
    costMultiplier: 0.15,
    description: "Быстрый и дешёвый",
    fallbackProviders: ["promptra"],
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek",
    provider: "promptra",
    modelId: "deepseek/deepseek-v4-flash",
    type: "chat",
    costMultiplier: 0.05,
    description: "Самый дешёвый",
    fallbackProviders: ["proxyapi"],
  },
];

/** Обратная совместимость со старыми роутами */
export const MODELS = {
  siteQuality: "anthropic/claude-sonnet-4.6",
  siteFast: "openai/gpt-5.6-luna",
  siteEdit: "openai/gpt-5.6-terra",
  chatDefault: "openai/gpt-5.6-luna",
  chatComplex: "openai/gpt-5.6-luna",
} as const;

export const DEFAULT_SITE_MODEL_ID = "claude-fable-5";
export const DEFAULT_IMAGE_MODEL_ID = "gemini-3.1-flash-image";
export const DEFAULT_CHAT_MODEL_ID = "gpt-5.6-luna-chat";

export function getModelsByType(type: ModelType): ModelConfig[] {
  return MODEL_CATALOG.filter((m) => m.type === type);
}

export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

export function getModelByUpstreamId(modelId: string): ModelConfig | undefined {
  return MODEL_CATALOG.find((m) => m.modelId === modelId);
}

export function groupModelsByProvider(
  type: ModelType
): Array<{ provider: ProviderId; label: string; models: ModelConfig[] }> {
  const orderedProviders: ProviderId[] = ["proxyapi", "promptra"];
  return orderedProviders
    .map((provider) => ({
      provider,
      label: PROVIDER_LABELS[provider],
      models: MODEL_CATALOG.filter(
        (m) => m.type === type && m.provider === provider
      ),
    }))
    .filter((g) => g.models.length > 0);
}

export function estimateCostUsd(
  model: string,
  opts?: {
    cached?: boolean;
    kind?: "site" | "siteEdit" | "chat" | "chatComplex" | "image";
    multiplier?: number;
  }
): number {
  if (opts?.cached) return 0;

  const fromCatalog =
    getModelById(model) ?? getModelByUpstreamId(model) ?? undefined;
  const mult = opts?.multiplier ?? fromCatalog?.costMultiplier ?? 1;

  let base = 0.01;
  if (opts?.kind === "siteEdit") base = 0.04;
  else if (opts?.kind === "chatComplex") base = 0.01;
  else if (opts?.kind === "chat") base = 0.002;
  else if (opts?.kind === "image") base = 0.04;
  else if (fromCatalog?.type === "site") base = 0.12;
  else if (fromCatalog?.type === "chat") base = 0.002;
  else if (fromCatalog?.type === "image") base = 0.04;

  return Number((base * mult).toFixed(6));
}

export function formatCostUsd(amount: number): string {
  if (amount <= 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/** Авто-выбор, если клиент не передал modelId */
export function selectSiteModel(input: {
  isEdit: boolean;
  qualityMode: QualityMode;
}): { model: string; catalogId: string; reason: string } {
  if (input.isEdit) {
    return {
      model: "openai/gpt-5.6-terra",
      catalogId: "gpt-5.6-terra",
      reason: "правка существующего сайта → GPT-5.6 Terra",
    };
  }
  if (input.qualityMode === "fast") {
    return {
      model: MODELS.siteFast,
      catalogId: "gpt-5.6-luna",
      reason: "режим «Быстро» → GPT-5.6 Luna",
    };
  }
  return {
    model: "anthropic/claude-fable-5",
    catalogId: DEFAULT_SITE_MODEL_ID,
    reason: "режим «Качественно» → Claude Fable 5",
  };
}

const COMPLEX_CHAT_RE =
  /\b(архитектур|algorithm|алгоритм|typescript|javascript|python|sql|postgres|docker|kubernetes|рефактор|debug|отладк|stack\s*trace|оптимиз|concurrency|многопоточ|oauth|jwt|websocket|graphql|microservice|микросервис|компил|regex|регулярн|big\s*o|сложн\w*\s+технич|напиши\s+код|напиши\s+функц|code\s+review)\b/i;

export function isComplexChatQuestion(message: string): boolean {
  const text = message.trim();
  if (text.length > 600) return true;
  if ((text.match(/```/g) ?? []).length >= 2) return true;
  if (COMPLEX_CHAT_RE.test(text)) return true;
  return false;
}

export function selectChatModel(message: string): {
  model: string;
  catalogId: string;
  reason: string;
} {
  const text = message.trim();
  if (
    text.length < 120 &&
    /^(?:привет|здравствуй(?:те)?|хай|hello|hi)|помоги(?:те)?|что\s+такое/iu.test(
      text
    )
  ) {
    return {
      model: "deepseek/deepseek-v4-flash",
      catalogId: "deepseek-chat",
      reason: "простой вопрос / приветствие → DeepSeek",
    };
  }
  if (isComplexChatQuestion(message)) {
    return {
      model: MODELS.chatComplex,
      catalogId: DEFAULT_CHAT_MODEL_ID,
      reason: "сложный вопрос → GPT-5.6 Luna",
    };
  }
  return {
    model: MODELS.chatDefault,
    catalogId: DEFAULT_CHAT_MODEL_ID,
    reason: "обычный вопрос → GPT-5.6 Luna",
  };
}

export function resolveSiteModelConfig(input: {
  modelId?: string | null;
  isEdit: boolean;
  qualityMode: QualityMode;
  forceVision?: boolean;
  expressMode?: boolean;
}): { config: ModelConfig; reason: string } {
  if (input.forceVision) {
    const preferred =
      (input.modelId ? getModelById(input.modelId) : null) ?? null;
    const visionCapable =
      preferred &&
      preferred.type === "site" &&
      /fable|sonnet|sol|terra|gpt-5\.6/i.test(preferred.id)
        ? preferred
        : null;
    const vision =
      visionCapable ??
      getModelById("claude-fable-5") ??
      getModelById("claude-sonnet-5") ??
      getModelById("gpt-5.6-sol") ??
      getModelById("claude-sonnet-4-6") ??
      getModelById(DEFAULT_SITE_MODEL_ID)!;
    return {
      config: vision,
      reason: `генерация по скриншоту → ${vision.name} (vision)`,
    };
  }

  if (input.expressMode && !input.isEdit) {
    const premium =
      getModelById("claude-fable-5") ??
      getModelById("gpt-5.6-sol") ??
      getModelById(DEFAULT_SITE_MODEL_ID)!;
    return {
      config: premium,
      reason: `экспресс-режим → ${premium.name}`,
    };
  }

  if (input.modelId) {
    const found = getModelById(input.modelId);
    if (found && found.type === "site") {
      return {
        config: found,
        reason: `выбор пользователя → ${found.name}`,
      };
    }
  }

  const auto = selectSiteModel({
    isEdit: input.isEdit,
    qualityMode: input.qualityMode,
  });
  const config =
    getModelById(auto.catalogId) ?? getModelById(DEFAULT_SITE_MODEL_ID)!;
  return { config, reason: auto.reason };
}

export function resolveImageModelConfig(modelId?: string | null): ModelConfig {
  const found = modelId ? getModelById(modelId) : undefined;
  if (found && found.type === "image") return found;
  // legacy aliases
  if (modelId === "gemini-flash-image") {
    return getModelById(DEFAULT_IMAGE_MODEL_ID)!;
  }
  return getModelById(DEFAULT_IMAGE_MODEL_ID)!;
}

export function resolveChatModelConfig(input: {
  modelId?: string | null;
  message: string;
}): { config: ModelConfig; reason: string } {
  const autoFirst = selectChatModel(input.message);
  if (autoFirst.catalogId === "deepseek-chat") {
    const deepseek = getModelById("deepseek-chat");
    if (deepseek) {
      return { config: deepseek, reason: autoFirst.reason };
    }
  }

  if (input.modelId) {
    // alias: site-style luna id → chat luna
    const alias =
      input.modelId === "gpt-5.6-luna"
        ? "gpt-5.6-luna-chat"
        : input.modelId === "deepseek-flash"
          ? "deepseek-chat"
          : input.modelId;
    const found = getModelById(alias);
    if (found && found.type === "chat") {
      return {
        config: found,
        reason: `выбор пользователя → ${found.name}`,
      };
    }
  }
  const auto = selectChatModel(input.message);
  const config =
    getModelById(auto.catalogId) ?? getModelById(DEFAULT_CHAT_MODEL_ID)!;
  return { config, reason: auto.reason };
}

export function buildPromptHash(parts: Record<string, unknown>): string {
  const normalized = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

export function modelShortLabel(model: string): string {
  const fromCatalog = getModelById(model) ?? getModelByUpstreamId(model);
  if (fromCatalog) return fromCatalog.name;
  if (model.includes("kimi")) return "Kimi K2.6";
  if (model.includes("fable")) return "Claude Fable 5";
  if (model.includes("claude-sonnet-5")) return "Claude Sonnet 5";
  if (model.includes("claude")) return "Claude Sonnet 4.6";
  if (model.includes("gpt-5.6-sol")) return "GPT-5.6 Sol";
  if (model.includes("gpt-5.6-terra")) return "GPT-5.6 Terra";
  if (model.includes("gpt-5.6-luna") || model.includes("gpt-5.6"))
    return "GPT-5.6 Luna";
  if (model.includes("gemini-3-pro-image")) return "Gemini Pro Image";
  if (model.includes("gemini") && model.includes("image"))
    return "Gemini Flash Image";
  if (model.includes("gemini") && model.includes("lite"))
    return "Gemini Flash Lite";
  if (model.includes("gpt-image")) return "GPT Image 2";
  if (model.includes("deepseek")) return "DeepSeek";
  return model;
}
