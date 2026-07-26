import {
  getModelById,
  resolveSiteModelConfig,
  type ModelConfig,
  type QualityMode,
} from "@/lib/models";
import {
  getTemplateById,
  matchSiteTemplate,
  type SiteTemplate,
} from "@/lib/siteTemplates";
import { CACHE_HIT_TOKEN_COST, getTokenCost } from "@/lib/tokenConfig";
import { modelIdForTier } from "@/lib/wizardBrief";

export type SiteRequestKind =
  | "chat"
  | "edit"
  | "template"
  | "create"
  | "default";

export type OptimizedSitePlan = {
  kind: SiteRequestKind;
  config: ModelConfig;
  reason: string;
  /** Чат-вопрос попал в генерацию сайта */
  chatSuggested: boolean;
  template: SiteTemplate | null;
};

export type SiteChargePreview = {
  /** Сколько спишем, если это НЕ точный повтор из кеша */
  tokens: number;
  /** Повтор того же промпта */
  cacheTokens: number;
  label: string;
  kind: SiteRequestKind;
  modelName: string;
};

const EDIT_RE =
  /(?:^|[\s,.:;!?«»"'(])(?:изменить|измени|поменять|поменяй|убери|удали|поправь|поправить|отредактируй|сделай\s+(?:все\s+)?(?:кнопк\S*|заголов\S*|фон|текст)\s+\S+|сделай\s+(?:красн\S*|зелён\S*|зелен\S*|син\S*|чёрн\S*|черн\S*|бел\S*|оранжев\S*|фиолетов\S*))/iu;

const CREATE_RE =
  /создай|сделай\s+сайт|сделать\s+сайт|лендинг|с\s*нуля|новый\s+сайт|сгенерируй(?:те)?\s+сайт|generate\s+(?:a\s+)?(?:site|landing)/iu;

const CHAT_RE =
  /^(?:привет|здравствуй(?:те)?|хай|hello|hi|добрый\s+(?:день|вечер|утро))(?=$|[\s,.!?…—–-])|(?:^|[\s])помоги(?:те)?(?=$|[\s,.!?])|(?:^|[\s])что\s+такое(?=$|[\s,.!?])|(?:^|[\s])как\s+дела(?=$|[\s,.!?])|(?:^|[\s])кто\s+ты(?=$|[\s,.!?])/iu;

export function classifySiteRequest(
  text: string,
  isEdit: boolean
): SiteRequestKind {
  const raw = text.trim();
  if (!raw && isEdit) return "edit";
  if (isEdit || EDIT_RE.test(raw)) return "edit";
  if (CHAT_RE.test(raw) && !CREATE_RE.test(raw)) return "chat";
  if (matchSiteTemplate(raw)) return "template";
  if (CREATE_RE.test(raw)) return "create";
  return "default";
}

/**
 * Интеллектуальный выбор модели.
 * reason всегда явный — без тихой подмены.
 */
export function resolveOptimizedSitePlan(input: {
  prompt: string;
  customRequirements?: string;
  isEdit: boolean;
  qualityMode: QualityMode;
  modelId?: string | null;
  forceVision?: boolean;
  expressMode?: boolean;
  /** Мастер: всегда Sol (+ опциональный шаблон), без Fable */
  wizardMode?: boolean;
  templateId?: string | null;
}): OptimizedSitePlan {
  const combined = `${input.prompt}\n${input.customRequirements ?? ""}`.trim();

  if (input.wizardMode && !input.isEdit) {
    const wanted =
      (input.modelId ? getModelById(input.modelId) : null) ??
      getModelById(modelIdForTier("simple")) ??
      getModelById("gpt-5.6-sol")!;
    const solOrPremium =
      wanted.type === "site" ? wanted : getModelById("gpt-5.6-sol")!;
    const template =
      (input.templateId ? getTemplateById(input.templateId) : null) ??
      matchSiteTemplate(combined);
    return {
      kind: template ? "template" : "create",
      config: solOrPremium,
      reason: template
        ? `мастер · шаблон «${template.name}» → ${solOrPremium.name}`
        : `мастер → ${solOrPremium.name}`,
      chatSuggested: false,
      template,
    };
  }

  const kind = classifySiteRequest(combined, input.isEdit);

  if (kind === "chat") {
    const deepseek =
      getModelById("deepseek-chat") ?? getModelById("gpt-5.6-luna-chat")!;
    return {
      kind,
      config: deepseek,
      reason: `похоже на вопрос в чат → ${deepseek.name} (откройте вкладку «Чат»)`,
      chatSuggested: true,
      template: null,
    };
  }

  // Скриншот — нужна vision-модель (явно в reason)
  if (input.forceVision) {
    const base = resolveSiteModelConfig({
      modelId: input.modelId,
      isEdit: input.isEdit,
      qualityMode: input.qualityMode,
      forceVision: true,
      expressMode: false,
    });
    return {
      kind: "create",
      config: base.config,
      reason: base.reason,
      chatSuggested: false,
      template: null,
    };
  }

  if (kind === "edit") {
    const terra =
      getModelById("gpt-5.6-terra") ?? getModelById("gpt-5.6-luna")!;
    return {
      kind,
      config: terra,
      reason: `правка / точечное изменение → ${terra.name}`,
      chatSuggested: false,
      template: null,
    };
  }

  if (kind === "template") {
    const template = matchSiteTemplate(combined);
    const terra =
      getModelById("gpt-5.6-terra") ?? getModelById("gpt-5.6-luna")!;
    return {
      kind,
      config: terra,
      reason: template
        ? `шаблон «${template.name}» + доработка → ${terra.name}`
        : `шаблон + доработка → ${terra.name}`,
      chatSuggested: false,
      template,
    };
  }

  // Экспресс / создание с нуля — премиум (честно дороже)
  if (kind === "create" || (input.expressMode && !input.isEdit)) {
    const fable =
      getModelById("claude-fable-5") ?? getModelById("gpt-5.6-sol")!;
    return {
      kind: "create",
      config: fable,
      reason: input.expressMode
        ? `экспресс / с нуля → ${fable.name}`
        : `создание сайта с нуля → ${fable.name}`,
      chatSuggested: false,
      template: null,
    };
  }

  const base = resolveSiteModelConfig({
    modelId: input.modelId,
    isEdit: input.isEdit,
    qualityMode: input.qualityMode,
    forceVision: false,
    expressMode: false,
  });
  return {
    kind: "default",
    config: base.config,
    reason: base.reason,
    chatSuggested: false,
    template: null,
  };
}

/** Превью списания для UI — совпадает с серверной логикой (кроме кеша). */
export function estimateSiteTokenCharge(input: {
  prompt: string;
  customRequirements?: string;
  isEdit: boolean;
  qualityMode?: QualityMode;
  modelId?: string | null;
  forceVision?: boolean;
  expressMode?: boolean;
}): SiteChargePreview {
  const plan = resolveOptimizedSitePlan({
    prompt: input.prompt,
    customRequirements: input.customRequirements,
    isEdit: input.isEdit,
    qualityMode: input.qualityMode ?? "quality",
    modelId: input.modelId,
    forceVision: input.forceVision,
    expressMode: input.expressMode,
  });

  if (plan.chatSuggested) {
    return {
      tokens: 0,
      cacheTokens: CACHE_HIT_TOKEN_COST,
      label: "Это вопрос для вкладки «Чат»",
      kind: plan.kind,
      modelName: plan.config.name,
    };
  }

  const tokens = getTokenCost(plan.config.id);
  return {
    tokens,
    cacheTokens: CACHE_HIT_TOKEN_COST,
    label: plan.reason,
    kind: plan.kind,
    modelName: plan.config.name,
  };
}

export function buildTemplateCustomizePrompt(input: {
  userPrompt: string;
  customRequirements: string;
  template: SiteTemplate;
  brandColors: string[];
  brandLogo: string;
}): string {
  return `Доработай готовый шаблон сайта под запрос пользователя.
Сохрани структуру и секции, обнови тексты, заголовки, CTA и цвета под нишу.
Верни ТОЛЬКО JSON {"html":"...","css":"...","js":"..."}.

Ниша/шаблон: ${input.template.name} (${input.template.category})
Запрос: ${input.userPrompt || "(нет)"}
Пожелания: ${input.customRequirements || "нет"}
Цвета бренда: ${input.brandColors.join(", ") || "не заданы"}
Логотип URL: ${input.brandLogo || "нет"}

--- HTML шаблона ---
${input.template.html}

--- CSS шаблона ---
${input.template.css}

--- JS шаблона ---
${input.template.js}`;
}
