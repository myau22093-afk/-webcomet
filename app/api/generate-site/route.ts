import { NextResponse } from "next/server";
import {
  assertHasTokens,
  buildStatusPayload,
  chargeTokens,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { designImageToDataUrl } from "@/lib/designImage";
import { findCachedSite, saveSite } from "@/lib/history";
import {
  buildPromptHash,
  estimateCostUsd,
  formatCostUsd,
  modelShortLabel,
  PROVIDER_LABELS,
  type QualityMode,
} from "@/lib/models";
import {
  buildTemplateCustomizePrompt,
  resolveOptimizedSitePlan,
} from "@/lib/costOptimization";
import {
  buildStructureAdaptPrompt,
  getStructureLayoutById,
  pickStructureLayout,
} from "@/lib/structureTemplates";
import { isWizardPremiumModel } from "@/lib/wizardBrief";
import { logApiUsage } from "@/lib/apiUsageLog";
import {
  ensureTemplatesSeeded,
  findCachedGeneration,
  saveCachedGeneration,
} from "@/lib/generationCache";
import {
  normalizeBrandColors,
  sectionLabels,
} from "@/lib/brand";
import { getTokenCost } from "@/lib/tokenConfig";
import { resolveSiteStyle } from "@/lib/siteStyles";
import { chatWithProviders, getModelConfig } from "@/lib/providers";
import type { ChatMessage } from "@/lib/promptra";
import { buildContactsPromptBlock, type UserContacts } from "@/lib/contacts";
import { stripLikelyOcrScraps } from "@/lib/ocrSanitize";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { aiQueueErrorResponse, withAiSlot } from "@/lib/aiQueue";

export const runtime = "nodejs";
export const maxDuration = 180;

const SYSTEM_PROMPT = `Ты — ведущий веб-дизайнер с 20-летним опытом. Твоя задача — создавать уникальные, дорогие, адаптивные лендинги, которые выглядят как работы топовых мировых студий.

Критично:
- Язык сайта: русский, деловой и дружелюбный. БЕЗ мата, сленговой пошлости и «юмора ради юмора» в названиях услуг/кнопок.
- css ОБЯЗАТЕЛЕН и НЕ пустой: современная вёрстка, шрифты через @import, отступы, адаптив. Сайт без нормального CSS — провал.
- html — только BODY (без doctype/html/head). Внешний вид задаётся полем css.

Требования к дизайну:
1. Используй современные градиенты, тени, скругления.
2. Добавляй плавные анимации (hover, появление при скролле).
3. Типографика: контрастные размеры, межстрочные интервалы, Google Fonts (Inter, Manrope, Montserrat).
4. Цветовая схема: гармоничная, под тематику.
5. Сетка: используй flexbox/grid для красивого выравнивания.
6. Кнопки: с эффектами наведения, большие, контрастные. Они ДОЛЖНЫ работать: кнопки и ссылки якоря (#...) реагируют на клик; интерактив через JS без ошибок.
7. Секции: Главный экран, Услуги, Отзывы, Форма заявки, Карта, Низ сайта.
8. Адаптивность: mobile-first, все элементы корректно отображаются на всех экранах.
9. Код должен быть чистым, без ошибок.

КРИТИЧЕСКИ ВАЖНО про текст пользователя:
- Используй ВЕСЬ текст, который дал пользователь в разделе «Твои пожелания» или в описании.
- НЕ обрезай и НЕ сокращай текст. Переноси формулировки и блоки текста целиком в соответствующие секции сайта.
- Не заменяй пользовательский текст «примерными» формулировками, если пользователь уже дал свой.

КРИТИЧЕСКИ ВАЖНО про контакты:
- ВСЕГДА используй контакты, переданные в промпте (телефон, email, соцсети), если они есть.
- Если контактов нет — используй стандартные заглушки.
- Контакты должны быть расположены в футере и/или в секции «Контакты».
- Телефон должен быть кликабельным для звонка (href="tel:+..."), email — для письма (href="mailto:..."), соцсети — иконками-ссылками.

КРИТИЧЕСКИ ВАЖНО про формы заявок:
- Форма обязана иметь поля name/имя, phone/телефон, message/сообщение (и email по желанию).
- У <form> поставь method="post" и data-mailto="EMAIL_ИЗ_КОНТАКТОВ" (тот же email, что в контактах).
- НЕ вешай на document глобальный preventDefault для всех submit — это ломает заявки на хостинге.
- В своём JS можно только валидировать поля; отправку заявок обработает WebComet (mailto) или Formspree, если action="https://formspree.io/f/...".
- После успешной клиентской проверки не блокируй submit глушилками.

КРИТИЧЕСКИ ВАЖНО про карту:
- Если нужна карта — используй iframe OpenStreetMap (embed) ИЛИ ссылку «Открыть на Яндекс.Картах» (https://yandex.ru/maps/...).
- Не оставляй пустой серый блок без смысла; хотя бы кнопка/ссылка на карты.

КРИТИЧЕСКИ ВАЖНО про скриншоты-референсы:
- Никогда не используй текст с изображений, если он не был явно передан как часть описания.
- Скриншоты — это только для дизайна (цвета, сетка, расположение блоков, отступы, шрифты, пропорции).
- Текст на скриншоте может быть нечитаемым или обрезанным — игнорируй его полностью.
- Заголовки, описания, пункты меню, кнопки и любой другой контент придумывай сам или бери из текстового описания пользователя.

Если пользователь дал изображения — используй КАЖДОЕ из них через <img src="точный URL">. Если нет — используй красивые цветовые блоки.

Ответ — ТОЛЬКО JSON в формате {"html": "...", "css": "...", "js": "..."}. Без лишнего текста.
- Не используй длинное тире (символ em dash) в заголовках и текстах: только обычный дефис (-) или запятая, как пишут люди.

Технические правила для WebComet:
- html — разметка BODY (без <!DOCTYPE>, <html>, <head>). Шрифты подключай через @import в css.
- css и js — только в отдельных полях JSON.
- Навигация: href="#..." для внутренних секций. Внешние соцсети/карты — нормальные https-ссылки.
- В js: меню/табы/аккордеоны; анимации через CSS или лёгкий JS. Не ломай формы глобальным preventDefault на submit.
- Код не должен падать с ошибками.`;

const VISUAL_REFERENCE_RULE = `Это изображение — ВИЗУАЛЬНЫЙ РЕФЕРЕНС. Ты должен повторить его дизайн (цвета, расположение блоков, сетку, отступы, шрифты). НЕ копируй текст с изображения — он может быть нечитаемым или обрезанным. Контент (заголовки, описания, тексты кнопок) придумай самостоятельно на основе темы, которую пользователь указал в описании.`;

const EDIT_SYSTEM_PROMPT = `Ты — веб-разработчик. Пользователь прислал существующий сайт (html/css/js) и просит ИЗМЕНИТЬ его.
Правила:
1. Сохрани то, что не просили менять.
2. Внеси только запрошенные правки.
3. html — разметка BODY; css и js — отдельные поля.
4. Используй ВЕСЬ текст из пожеланий пользователя без сокращений.
5. Не ломай формы: не добавляй глобальный preventDefault на submit.
6. ОТВЕТ — только JSON {"html":"...","css":"...","js":"..."} без markdown.`;

const MAX_PROMPT_CHARS = 8000;
const EMPTY_SITE_FALLBACK = {
  html: `<section style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:32px;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;"><div><h1 style="margin:0 0 12px;font-size:28px;">Сайт не сгенерировался</h1><p style="margin:0;opacity:.8;">Попробуйте ещё раз или смените модель.</p></div></section>`,
  css: "",
  js: "",
};

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

/** Достаёт значение строкового поля из возможно обрезанного JSON */
function extractJsonStringField(source: string, field: string): string {
  const key = `"${field}"`;
  const keyIndex = source.indexOf(key);
  if (keyIndex === -1) return "";

  const colon = source.indexOf(":", keyIndex + key.length);
  if (colon === -1) return "";

  let i = colon + 1;
  while (i < source.length && /\s/.test(source[i])) i++;
  if (source[i] !== '"') return "";
  i++;

  let out = "";
  let escaped = false;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      out += `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }

  return unescapeJsonString(out);
}

function stripDocumentShell(html: string): string {
  let result = html.trim();
  if (/<!doctype|<html/i.test(result)) {
    const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch?.[1]) {
      result = bodyMatch[1].trim();
    } else {
      result = result
        .replace(/<!doctype[^>]*>/i, "")
        .replace(/<\/?html[^>]*>/gi, "")
        .replace(/<head[\s\S]*?<\/head>/i, "")
        .replace(/<\/?body[^>]*>/gi, "")
        .trim();
    }
  }
  return result;
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.startsWith("<body") ||
    t.startsWith("<section") ||
    t.startsWith("<div") ||
    t.startsWith("<nav") ||
    t.startsWith("<header")
  );
}

function parseModelJson(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const wrap = (html: string, css = "", js = "") => ({
    html: stripDocumentShell(html),
    css,
    js,
  });

  // 1) Полный JSON
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        html?: string;
        css?: string;
        js?: string;
      };
      if (parsed.html) {
        return wrap(parsed.html, parsed.css ?? "", parsed.js ?? "");
      }
    } catch {
      // ниже — восстановление обрезанного ответа
    }
  }

  // 2) Обрезанный JSON: вытаскиваем поля по отдельности
  const html = extractJsonStringField(cleaned, "html");
  if (html.trim()) {
    return wrap(
      html,
      extractJsonStringField(cleaned, "css"),
      extractJsonStringField(cleaned, "js")
    );
  }

  // 3) Модель вернула сырой HTML
  if (looksLikeHtml(cleaned)) {
    return wrap(cleaned);
  }

  throw new Error("Модель не вернула JSON-объект");
}

function sanitizeImages(
  parts: { html: string; css: string; js: string },
  allowedImages: string[],
  hasImages: boolean
) {
  let { html, css, js } = parts;

  if (!hasImages) {
    html = html.replace(
      /<img\b[^>]*>/gi,
      '<div class="wc-placeholder" style="display:flex;align-items:center;justify-content:center;min-height:180px;background:#e5e7eb;color:#374151;border-radius:12px;padding:16px;text-align:center;">Здесь будет ваше изображение</div>'
    );
    css = css
      .replace(/url\(\s*['"]?https?:\/\/[^)'"]+['"]?\s*\)/gi, "none")
      .replace(/url\(\s*['"]?\/\/[^)'"]+['"]?\s*\)/gi, "none");
  } else {
    html = html.replace(
      /<img\b([^>]*?)src\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
      (full, _before, _quote, src) => {
        if (allowedImages.includes(src)) return full;
        return `<div class="wc-placeholder" style="display:flex;align-items:center;justify-content:center;min-height:180px;background:#e5e7eb;color:#374151;border-radius:12px;padding:16px;text-align:center;">Здесь будет ваше изображение</div>`;
      }
    );
    css = css.replace(
      /url\(\s*['"]?(https?:\/\/[^)'"]+|\/\/[^)'"]+|\/uploads\/[^)'"]+)['"]?\s*\)/gi,
      (full, url) => {
        if (url.startsWith("/uploads/") && allowedImages.includes(url)) {
          return full;
        }
        return "none";
      }
    );
  }

  return { html, css, js };
}

function buildUserPrompt(input: {
  prompt: string;
  userPrompt: string;
  customRequirements: string;
  images: string[];
  hasImages: boolean;
  styleLabel: string;
  styleGuide: string;
  hasDesignImage: boolean;
  brandColors: string[];
  brandLogo: string;
  sections: string[];
  expressMode: boolean;
  contacts: UserContacts;
  useContacts: boolean;
}) {
  const hasUserContent = Boolean(
    input.userPrompt.trim() || input.customRequirements.trim()
  );

  const imagesBlock = input.hasImages
    ? `Вот изображения-ассеты, которые пользователь загрузил для вставки на сайт: [${input.images.join(", ")}]. ТЫ ОБЯЗАН использовать КАЖДОЕ из них в дизайне через <img src="ТОЧНЫЙ_URL">. Это НЕ референсный скриншот — это файлы для контента.`
    : "Контент-изображений нет — используй красивые цветовые блоки, без внешних <img>.";

  const designBlock = input.hasDesignImage
    ? `${VISUAL_REFERENCE_RULE}

${
  hasUserContent
    ? "Тема и весь текстовый контент сайта бери ТОЛЬКО из описания и раздела «Твои пожелания». Скриншот не источник текстов."
    : "Пользователь не дал текстового описания. Определи тему по визуальному стилю референса и сгенерируй весь контент самостоятельно (как в экспресс-режиме): название, слоганы, услуги, отзывы, кнопки. Текст со скриншота НЕ копируй."
}`
    : "";

  const brandBlock = `Используй эти цвета: [${input.brandColors.join(", ")}]${
    input.hasDesignImage
      ? " — если референс диктует палитру, приоритет у референса"
      : ""
  }. Логотип: ${input.brandLogo || "нет — используй текстовый логотип бренда"}.`;

  const labels = sectionLabels(input.sections);
  const sectionsBlock =
    labels.length > 0
      ? `Создай сайт, состоящий только из следующих секций: [${labels.join(", ")}]. Остальные секции не добавляй.`
      : "Секции выбери сам по теме сайта.";

  const expressBlock =
    input.expressMode || (input.hasDesignImage && !hasUserContent)
      ? "Придумай законченный качественный контент сам (если пользователь уже дал тексты — не заменяй их)."
      : "";

  const contentBlock = hasUserContent
    ? `ОСНОВНОЙ ИСТОЧНИК КОНТЕНТА (не скриншот):
Описание сайта: ${input.userPrompt || "(нет — см. пожелания)"}
Раздел «Твои пожелания» (используй ВЕСЬ текст дословно, без сокращений):
${input.customRequirements || "нет"}`
    : input.hasDesignImage
      ? "Текстового описания нет — сгенерируй контент самостоятельно по визуальному стилю референса."
      : `Описание сайта: ${input.prompt}`;

  const contactsForPrompt: UserContacts = input.useContacts
    ? input.contacts
    : {
        phone: "",
        email: "",
        socials: [],
        show_contacts: false,
      };
  const contactsBlock = buildContactsPromptBlock(contactsForPrompt);

  return `hasImages: ${input.hasImages}
hasVisualReference: ${input.hasDesignImage}

${contentBlock}

${contactsBlock}

Стиль дизайна (каталог): ${input.styleLabel}.
${brandBlock}
${sectionsBlock}
${expressBlock}
${designBlock}
${imagesBlock}

${!input.hasDesignImage ? `Обязательно соблюдай стиль «${input.styleLabel}»:\n${input.styleGuide}` : `При наличии референса визуал важнее каталожного стиля. Каталожный стиль «${input.styleLabel}» — мягкая подсказка, если не противоречит референсу:\n${input.styleGuide}`}

Верни ТОЛЬКО полный закрытый JSON {"html","css","js"}.`;
}

function buildVisionUserMessage(
  text: string,
  designDataUrl: string | null
): ChatMessage {
  if (!designDataUrl) {
    return { role: "user", content: text };
  }
  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `${VISUAL_REFERENCE_RULE}\n\n${text}`,
      },
      { type: "image_url", image_url: { url: designDataUrl } },
    ],
  };
}

function findMissingImages(
  parts: { html: string; css: string; js: string },
  images: string[]
): string[] {
  const blob = `${parts.html}\n${parts.css}\n${parts.js}`;
  return images.filter((url) => !blob.includes(url));
}

function injectMissingImages(
  html: string,
  missing: string[]
): string {
  if (missing.length === 0) return html;
  const blocks = missing
    .map(
      (url) =>
        `<img src="${url}" alt="Загруженное изображение" style="width:100%;max-width:560px;height:auto;border-radius:16px;object-fit:cover;display:block;margin:12px auto;" />`
    )
    .join("\n");
  return `${html}
<section class="wc-forced-images" style="padding:48px 24px;display:grid;gap:16px;justify-items:center;">
${blocks}
</section>`;
}

function buildRetryPrompt(input: {
  previousHtml: string;
  previousCss: string;
  previousJs: string;
  missing: string[];
  allImages: string[];
}) {
  return `Твой предыдущий ответ НЕ содержит все обязательные изображения.
Отсутствуют: [${input.missing.join(", ")}]
Все обязательные URL: [${input.allImages.join(", ")}]

Исправь код: вставь КАЖДЫЙ отсутствующий URL через <img src="..."> в подходящие секции (Главный экран / Услуги / Отзывы / О нас).
Не добавляй чужие картинки. Верни полный JSON {"html","css","js"}.

Текущий HTML:
${input.previousHtml}

Текущий CSS:
${input.previousCss}

Текущий JS:
${input.previousJs}`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      prompt?: string;
      customRequirements?: string;
      images?: string[];
      hasImages?: boolean;
      isEdit?: boolean;
      qualityMode?: QualityMode;
      modelId?: string;
      style?: string;
      designImage?: string;
      existingHtml?: string;
      existingCss?: string;
      existingJs?: string;
      brandLogo?: string;
      brandColors?: unknown;
      sections?: unknown;
      expressMode?: boolean;
      useContacts?: boolean;
      wizardMode?: boolean;
      templateId?: string;
      structureLayoutId?: string;
    };

    const prompt = body.prompt?.trim() ?? "";
    const customRequirements = body.customRequirements?.trim() ?? "";
    const designImage = body.designImage?.trim() ?? "";
    const images = Array.isArray(body.images)
      ? body.images.filter((item) => typeof item === "string" && item.length > 0)
      : [];
    const hasImages =
      typeof body.hasImages === "boolean" ? body.hasImages : images.length > 0;
    const isEdit = Boolean(body.isEdit);
    const expressMode = Boolean(body.expressMode) && !isEdit;
    const wizardMode = Boolean(body.wizardMode) && !isEdit;
    const requestedTemplateId =
      typeof body.templateId === "string" ? body.templateId.trim() : "";
    const requestedStructureLayoutId =
      typeof body.structureLayoutId === "string"
        ? body.structureLayoutId.trim()
        : "";
    const brandLogo =
      typeof body.brandLogo === "string" ? body.brandLogo.trim() : "";
    const brandColors = normalizeBrandColors(body.brandColors);
    const sections = Array.isArray(body.sections)
      ? body.sections.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];
    const qualityMode: QualityMode =
      body.qualityMode === "fast" ? "fast" : "quality";
    const siteStyle = resolveSiteStyle(body.style);

    const combinedPromptLen = prompt.length + customRequirements.length;
    if (combinedPromptLen > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        {
          error: `Слишком длинный текст (описание + пожелания): ${combinedPromptLen} символов. Максимум ${MAX_PROMPT_CHARS}. Сократите «Твои пожелания» или описание.`,
          maxChars: MAX_PROMPT_CHARS,
          currentChars: combinedPromptLen,
        },
        { status: 400 }
      );
    }

    if (!prompt && !designImage && !expressMode) {
      return NextResponse.json(
        { error: "Нужен промпт или скриншот дизайна" },
        { status: 400 }
      );
    }

    const hasUserTextPrompt = Boolean(prompt || customRequirements);
    const referenceOnlyMode = Boolean(designImage) && !hasUserTextPrompt && !isEdit;

    const effectivePrompt =
      prompt ||
      (expressMode || referenceOnlyMode
        ? "Придумай и создай законченный современный лендинг"
        : designImage
          ? "Создай сайт по визуальному референсу (контент придумай сам)"
          : "");

    if (isEdit && !body.existingHtml?.trim()) {
      return NextResponse.json(
        { error: "Для правки нужен существующий html" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const profileContacts: UserContacts = {
      phone: profile.phone ?? "",
      email: profile.email ?? "",
      socials: profile.socials ?? [],
      show_contacts: profile.show_contacts !== false,
    };
    // Явный ответ Мастера/Редактора важнее глобального чекбокса в Настройках
    const useContacts =
      typeof body.useContacts === "boolean"
        ? body.useContacts
        : profileContacts.show_contacts;

    let designDataUrl: string | null = null;

    if (designImage && !isEdit) {
      designDataUrl = await designImageToDataUrl(designImage);
      if (!designDataUrl) {
        return NextResponse.json(
          { error: "Не удалось прочитать скриншот дизайна" },
          { status: 400 }
        );
      }
      console.log(
        `[ai] generate-site visual reference attached, dataUrl length=${designDataUrl.length}`
      );
    }

    const plan = resolveOptimizedSitePlan({
      prompt: `${effectivePrompt}\n${customRequirements}`.trim(),
      customRequirements,
      isEdit,
      qualityMode,
      modelId: body.modelId,
      forceVision: Boolean(designDataUrl),
      expressMode: expressMode || referenceOnlyMode,
      wizardMode,
      templateId: requestedTemplateId || null,
    });

    if (plan.chatSuggested) {
      await logApiUsage({
        userId: auth.user.id,
        route: "/api/generate-site",
        modelId: plan.config.id,
        modelLabel: modelShortLabel(plan.config.id),
        tokenCost: 0,
        costUsd: 0,
        kind: plan.kind,
        reason: plan.reason,
      });
      return NextResponse.json(
        {
          error:
            "Похоже, это вопрос для чата, а не генерация сайта. Откройте вкладку «Чат» — там для таких запросов используется DeepSeek.",
          chatSuggested: true,
          modelId: plan.config.id,
          modelLabel: modelShortLabel(plan.config.id),
          modelReason: plan.reason,
        },
        { status: 400 }
      );
    }

    void ensureTemplatesSeeded();

    const modelConfig = plan.config;
    let reason = plan.reason;
    const model = modelConfig.modelId;
    const generateTokenCost = getTokenCost(modelConfig.id);
    const activeTemplate = plan.template;

    // Мастер «Простой» (Sol): layout-скелет → дешёвая адаптация.
    // «Премиум» (Kimi/Fable): полный сайт с нуля, без нишевых/structure шаблонов.
    const isWizardPremium =
      wizardMode && !isEdit && isWizardPremiumModel(modelConfig.id);
    const useStructureAdapt =
      wizardMode && !isEdit && !isWizardPremium;

    const structureLayout = useStructureAdapt
      ? getStructureLayoutById(requestedStructureLayoutId) ??
        pickStructureLayout(
          `${effectivePrompt}\n${customRequirements}\n${brandColors.join(",")}`
        )
      : null;

    if (structureLayout) {
      reason = `мастер · структура «${structureLayout.id}» → ${modelConfig.name}`;
    } else if (isWizardPremium) {
      reason = `мастер · премиум с нуля → ${modelConfig.name}`;
    }

    const promptHash = buildPromptHash({
      prompt: effectivePrompt,
      customRequirements,
      images: hasImages ? images : [],
      qualityMode,
      style: siteStyle.id,
      designImage: designImage || null,
      brandLogo: brandLogo || null,
      brandColors,
      sections,
      expressMode,
      isEdit: false,
      templateId: activeTemplate?.id ?? null,
      structureLayoutId: structureLayout?.id ?? null,
      optimizeKind: plan.kind,
    });

    // Повтор того же запроса → отдаём из кеша, но СПИСЫВАЕМ токены (API = 0 → жирная маржа)
    if (!isEdit) {
      const globalCached = await findCachedGeneration(promptHash);
      const personalCached =
        globalCached?.html
          ? null
          : await findCachedSite(auth.user.id, promptHash);
      const hit = globalCached?.html
        ? {
            html: globalCached.html,
            css: globalCached.css ?? "",
            js: globalCached.js ?? "",
            sourceId: globalCached.id,
            created_at: globalCached.created_at,
            modelUsed: globalCached.model_used || modelConfig.id,
            cacheKind: "global" as const,
          }
        : personalCached?.html
          ? {
              html: personalCached.html,
              css: personalCached.css ?? "",
              js: personalCached.js ?? "",
              sourceId: personalCached.id,
              created_at: personalCached.created_at,
              modelUsed: modelConfig.id,
              cacheKind: "personal" as const,
            }
          : null;

      if (hit) {
        const cacheCharge = getTokenCost(modelConfig.id);
        try {
          assertHasTokens(profile, cacheCharge);
        } catch (balanceError) {
          return NextResponse.json(
            {
              error:
                balanceError instanceof Error
                  ? balanceError.message
                  : "Недостаточно токенов. Пополните баланс.",
              token_balance: profile.token_balance,
              token_cost: cacheCharge,
            },
            { status: 402 }
          );
        }

        const spend = await chargeTokens(admin, profile, cacheCharge, {
          modelId: modelConfig.id,
          description: `Генерация сайта · из кеша (полная цена)`,
        });
        await logApiUsage({
          userId: auth.user.id,
          route: "/api/generate-site",
          modelId: modelConfig.id,
          modelLabel: modelShortLabel(modelConfig.id),
          tokenCost: spend.charged,
          costUsd: 0,
          cached: true,
          kind: plan.kind,
          reason:
            hit.cacheKind === "global"
              ? `cache-hit global −${cacheCharge} (full price, API 0)`
              : `cache-hit personal −${cacheCharge} (full price, API 0)`,
          promptHash,
        });

        const savedFromCache =
          hit.cacheKind === "global"
            ? await saveSite({
                userId: auth.user.id,
                prompt: effectivePrompt,
                html: hit.html,
                css: hit.css,
                js: hit.js,
                promptHash,
                version: 1,
                rootPrompt: effectivePrompt,
              })
            : null;

        return NextResponse.json({
          html: hit.html,
          css: hit.css,
          js: hit.js,
          id: savedFromCache?.id ?? hit.sourceId,
          created_at: savedFromCache?.created_at ?? hit.created_at,
          cached: true,
          style: siteStyle.id,
          styleLabel: siteStyle.label,
          model,
          modelId: modelConfig.id,
          modelLabel: modelShortLabel(modelConfig.id),
          modelReason: reason,
          provider: modelConfig.provider,
          providerLabel: PROVIDER_LABELS[modelConfig.provider],
          costUsd: 0,
          costLabel: formatCostUsd(0),
          token_cost: spend.charged,
          token_balance: spend.balance,
          total_tokens_used: spend.totalUsed,
          remaining: spend.balance,
          optimizeKind: plan.kind,
          structureLayoutId: structureLayout?.id ?? null,
        });
      }
    }

    // Новая генерация — проверяем баланс под выбранную модель
    try {
      assertHasTokens(profile, generateTokenCost);
    } catch (balanceError) {
      return NextResponse.json(
        {
          error:
            balanceError instanceof Error
              ? balanceError.message
              : "Недостаточно токенов. Пополните баланс.",
          token_balance: profile.token_balance,
          token_cost: generateTokenCost,
        },
        { status: 402 }
      );
    }

    const tokenCost = generateTokenCost;

    // Resolve credentials (OpenAI-compatible baseURL + apiKey) + log
    try {
      const wired = getModelConfig(modelConfig.id);
      console.log(
        `[ai] generate-site using provider=${wired.provider} model=${wired.modelId} catalog=${modelConfig.id} kind=${plan.kind} baseURL=${wired.baseURL}`
      );
    } catch (credError) {
      console.error(`[ai] generate-site getModelConfig failed:`, credError);
      return NextResponse.json(
        {
          error: `${modelConfig.name} сейчас недоступна. Выберите другую модель в списке.`,
          modelId: modelConfig.id,
          modelLabel: modelShortLabel(modelConfig.id),
          detail:
            credError instanceof Error
              ? credError.message
              : "Провайдер не настроен",
        },
        { status: 503 }
      );
    }

    const finalPrompt = isEdit
      ? `Измени сайт по запросу: ${prompt}
Дополнительно: ${customRequirements || "нет"}

Текущий HTML:
${body.existingHtml}

Текущий CSS:
${body.existingCss ?? ""}

Текущий JS:
${body.existingJs ?? ""}`
      : structureLayout
        ? buildStructureAdaptPrompt({
            userPrompt: prompt || effectivePrompt,
            customRequirements,
            layout: structureLayout,
            brandColors,
            brandLogo,
          })
        : isWizardPremium
          ? buildUserPrompt({
              prompt: effectivePrompt,
              userPrompt: prompt,
              customRequirements,
              images: hasImages ? images : [],
              hasImages,
              styleLabel: siteStyle.label,
              styleGuide: siteStyle.guide,
              hasDesignImage: Boolean(designDataUrl),
              brandColors,
              brandLogo,
              sections,
              expressMode: expressMode || referenceOnlyMode,
              contacts: profileContacts,
              useContacts,
            })
          : activeTemplate
            ? buildTemplateCustomizePrompt({
                userPrompt: prompt || effectivePrompt,
                customRequirements,
                template: activeTemplate,
                brandColors,
                brandLogo,
              })
            : buildUserPrompt({
                prompt: effectivePrompt,
                userPrompt: prompt,
                customRequirements,
                images: hasImages ? images : [],
                hasImages,
                styleLabel: siteStyle.label,
                styleGuide: siteStyle.guide,
                hasDesignImage: Boolean(designDataUrl),
                brandColors,
                brandLogo,
                sections,
                expressMode: expressMode || referenceOnlyMode,
                contacts: profileContacts,
                useContacts,
              });

    const systemContent = isEdit ? EDIT_SYSTEM_PROMPT : SYSTEM_PROMPT;
    let siteParts: { html: string; css: string; js: string } | null = null;
    let lastRaw = "";
    let usedProvider = modelConfig.provider;
    let usedProviderLabel = PROVIDER_LABELS[modelConfig.provider];
    const maxAttempts = hasImages && !isEdit ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const userText =
        attempt === 1 || !siteParts
          ? finalPrompt
          : buildRetryPrompt({
              previousHtml: siteParts.html,
              previousCss: siteParts.css,
              previousJs: siteParts.js,
              missing: findMissingImages(siteParts, images),
              allImages: images,
            });

      let content: string;
      try {
        const completion = await withAiSlot(() =>
          chatWithProviders({
            config: modelConfig,
            messages: [
              { role: "system", content: systemContent },
              buildVisionUserMessage(userText, designDataUrl),
            ],
            temperature: attempt === 1 ? 0.7 : 0.35,
            max_tokens: isEdit ? 8000 : 12000,
            stream: true,
          })
        );
        content = completion.content;
        usedProvider = completion.provider;
        usedProviderLabel = completion.providerLabel;
        if (completion.usedFallback) {
          reason = `${reason} · fallback → ${completion.providerLabel}`;
        }
      } catch (modelError) {
        console.error(`generate-site model error (attempt ${attempt}):`, modelError);
        if (attempt === maxAttempts && !siteParts) {
          return NextResponse.json(
            {
              error:
                modelError instanceof Error
                  ? modelError.message
                  : "Ошибка AI API",
              model,
              modelId: modelConfig.id,
              modelLabel: modelShortLabel(modelConfig.id),
              provider: usedProvider,
            },
            { status: 500 }
          );
        }
        continue;
      }

      lastRaw = content;
      try {
        siteParts = parseModelJson(content);
        if (!siteParts.html?.trim()) {
          console.error(
            `generate-site empty html (attempt ${attempt}), raw length=${content.length}`
          );
          siteParts = { ...EMPTY_SITE_FALLBACK };
        } else if ((siteParts.css ?? "").trim().length < 80) {
          // Модель отдала «голый» HTML без стилей — пробуем ещё раз
          console.error(
            `generate-site weak css (attempt ${attempt}), cssLen=${(siteParts.css ?? "").length}`
          );
          if (attempt < maxAttempts) {
            siteParts = null;
            continue;
          }
        }
      } catch (parseError) {
        console.error(`JSON parse error (attempt ${attempt}):`, parseError);
        console.error(
          `JSON parse raw (first 2000 chars):`,
          content.slice(0, 2000)
        );
        if (attempt === maxAttempts) {
          return NextResponse.json(
            {
              error: "Ошибка генерации, попробуйте ещё раз",
              detail:
                parseError instanceof Error
                  ? parseError.message
                  : "Невалидный JSON от модели",
              rawPreview: content.slice(0, 500),
            },
            { status: 500 }
          );
        }
        continue;
      }

      siteParts = sanitizeImages(siteParts, images, hasImages);
      if (designDataUrl) {
        siteParts = {
          ...siteParts,
          html: stripLikelyOcrScraps(siteParts.html),
        };
      }

      if (!hasImages || isEdit) break;

      const missing = findMissingImages(siteParts, images);
      if (missing.length === 0) break;

      console.warn(
        `generate-site missing images attempt ${attempt}:`,
        missing
      );

      if (attempt === maxAttempts) {
        siteParts = {
          ...siteParts,
          html: injectMissingImages(siteParts.html, missing),
        };
      }
    }

    if (!siteParts) {
      return NextResponse.json(
        {
          error: "Ошибка генерации, попробуйте ещё раз",
          rawPreview: lastRaw.slice(0, 500),
        },
        { status: 500 }
      );
    }

    if (!siteParts.html?.trim()) {
      console.error("generate-site final empty html, using fallback");
      siteParts = { ...EMPTY_SITE_FALLBACK };
    } else if (designDataUrl) {
      siteParts = {
        ...siteParts,
        html: stripLikelyOcrScraps(siteParts.html),
      };
    }

    const spend = await chargeTokens(admin, profile, tokenCost, {
      modelId: modelConfig.id,
      description: `Генерация сайта · ${modelConfig.name}${
        plan.kind !== "default" ? ` · ${plan.kind}` : ""
      }`,
    });
    const status = buildStatusPayload({
      ...profile,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
    });

    const costUsd = estimateCostUsd(modelConfig.id, {
      kind: isEdit ? "siteEdit" : undefined,
      multiplier: modelConfig.costMultiplier,
    });

    if (!isEdit) {
      await saveCachedGeneration({
        promptHash,
        html: siteParts.html,
        css: siteParts.css,
        js: siteParts.js,
        modelUsed: modelConfig.id,
      });
    }

    await logApiUsage({
      userId: auth.user.id,
      route: "/api/generate-site",
      modelId: modelConfig.id,
      modelLabel: modelShortLabel(modelConfig.id),
      provider: usedProviderLabel,
      tokenCost: spend.charged,
      costUsd,
      cached: false,
      kind: plan.kind,
      reason,
      promptHash: isEdit ? null : promptHash,
      meta: {
        templateId: activeTemplate?.id ?? null,
        expressMode,
        isEdit,
      },
    });

    const usedImages = hasImages
      ? images.filter((url) =>
          `${siteParts!.html}\n${siteParts!.css}\n${siteParts!.js}`.includes(url)
        )
      : [];
    const saved = await saveSite({
      userId: auth.user.id,
      prompt: isEdit ? `[edit] ${prompt}` : effectivePrompt,
      html: siteParts.html,
      css: siteParts.css,
      js: siteParts.js,
      promptHash: isEdit ? undefined : promptHash,
      version: 1,
      rootPrompt: isEdit ? undefined : effectivePrompt,
    });

    return NextResponse.json({
      ...siteParts,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? new Date().toISOString(),
      cached: false,
      style: siteStyle.id,
      styleLabel: siteStyle.label,
      designImage: designImage || null,
      model,
      modelId: modelConfig.id,
      modelLabel: modelShortLabel(modelConfig.id),
      modelReason: reason,
      provider: usedProvider,
      providerLabel: usedProviderLabel,
      costUsd,
      costLabel: formatCostUsd(costUsd),
      token_cost: spend.charged,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
      imagesUsed: usedImages,
      imagesMissing: hasImages
        ? images.filter((url) => !usedImages.includes(url))
        : [],
      remaining: status.token_balance,
      optimizeKind: plan.kind,
      templateId: activeTemplate?.id ?? null,
      structureLayoutId: structureLayout?.id ?? null,
    });
  } catch (error) {
    console.error("generate-site error:", error);
    const queued = aiQueueErrorResponse(error);
    if (queued) {
      return NextResponse.json(queued.body, { status: queued.status });
    }
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка генерации сайта" },
      { status: 500 }
    );
  }
}
