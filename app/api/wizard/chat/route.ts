import { NextResponse } from "next/server";
import {
  assertHasTokens,
  chargeTokens,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { humanizeUpstreamError } from "@/lib/apiErrors";
import { getModelById, modelShortLabel, PROVIDER_LABELS } from "@/lib/models";
import { chatWithProviders, getModelConfig } from "@/lib/providers";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenCost } from "@/lib/tokenConfig";
import { aiQueueErrorResponse, withAiSlot } from "@/lib/aiQueue";
import { WIZARD_CHAT_MODEL_ID } from "@/lib/wizardBrief";

export const runtime = "nodejs";

const WIZARD_SYSTEM = `Ты — консультант WebComet в мастере создания сайта.
Правила:
- Отвечай ОЧЕНЬ кратко по-русски: 1–2 коротких предложения.
- НЕ задавай кучу уточняющих вопросов подряд.
- НЕ придумывай структуру сайта, секции и тексты заранее.
- НЕ предлагай HTML/CSS/JS.
- НЕ говори «выберите блоки/палитру в интерфейсе», если пользователь просто пишет название или ответ — мастер сам покажет нужную карточку.
- Если пользователь уточняет тему или название — коротко подтверди (1 фраза). Без «вау», без длинных комплиментов.
- Не пиши простыни.`;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      briefSummary?: string;
    };

    const message = body.message?.trim() ?? "";
    if (!message) {
      return NextResponse.json(
        { error: "Сообщение обязательно" },
        { status: 400 }
      );
    }

    const modelConfig = getModelById(WIZARD_CHAT_MODEL_ID);
    if (!modelConfig) {
      return NextResponse.json(
        { error: "Модель чата мастера недоступна" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const tokenCost = getTokenCost(modelConfig.id);

    try {
      assertHasTokens(profile, tokenCost);
    } catch (balanceError) {
      return NextResponse.json(
        {
          error:
            balanceError instanceof Error
              ? balanceError.message
              : "Недостаточно токенов. Пополните баланс.",
          token_balance: profile.token_balance,
          token_cost: tokenCost,
        },
        { status: 402 }
      );
    }

    try {
      getModelConfig(modelConfig.id);
    } catch {
      return NextResponse.json(
        {
          error: `${modelConfig.name} сейчас недоступна. Попробуйте позже.`,
          modelId: modelConfig.id,
        },
        { status: 503 }
      );
    }

    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const briefBlock = body.briefSummary?.trim()
      ? `\n\nТекущий бриф пользователя:\n${body.briefSummary.trim()}`
      : "";

    try {
      const completion = await withAiSlot(() =>
        chatWithProviders({
          config: modelConfig,
          messages: [
            { role: "system", content: WIZARD_SYSTEM + briefBlock },
            ...history
              .filter((h) => h.role === "user" || h.role === "assistant")
              .map((h) => ({ role: h.role, content: h.content })),
            { role: "user", content: message },
          ],
          temperature: 0.4,
          max_tokens: 180,
        })
      );

      const spend = await chargeTokens(admin, profile, tokenCost, {
        modelId: modelConfig.id,
        description: `Мастер · чат · ${modelConfig.name}`,
      });

      return NextResponse.json({
        response: completion.content,
        reply: completion.content,
        modelId: modelConfig.id,
        modelLabel: modelShortLabel(modelConfig.id),
        provider: completion.provider,
        providerLabel: completion.providerLabel ?? PROVIDER_LABELS[completion.provider],
        token_cost: spend.charged,
        token_balance: spend.balance,
      });
    } catch (error) {
      const queued = aiQueueErrorResponse(error);
      if (queued) {
        return NextResponse.json(queued.body, { status: queued.status });
      }
      return NextResponse.json(
        {
          error: `${modelConfig.name} сейчас недоступна. Выберите другой способ или позже.`,
          detail: humanizeUpstreamError(error),
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("wizard/chat error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка чата мастера" },
      { status: 500 }
    );
  }
}
