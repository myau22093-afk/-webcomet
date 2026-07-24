import { NextResponse } from "next/server";
import {
  assertHasTokens,
  buildStatusPayload,
  chargeTokens,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { saveChatExchange } from "@/lib/history";
import { humanizeUpstreamError } from "@/lib/apiErrors";
import {
  estimateCostUsd,
  formatCostUsd,
  modelShortLabel,
  PROVIDER_LABELS,
  resolveChatModelConfig,
  type ProviderId,
} from "@/lib/models";
import { chatWithProviders, getModelConfig } from "@/lib/providers";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenCost } from "@/lib/tokenConfig";
import { aiQueueErrorResponse, withAiSlot } from "@/lib/aiQueue";

const CHAT_SYSTEM = `Ты — полезный ассистент WebComet. Отвечай кратко и по делу на русском языке.
Помогай с идеями сайтов, текстами, дизайном и промптами для генерации.`;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      message?: string;
      modelId?: string;
      conversationId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const message = body.message?.trim() ?? "";
    if (!message) {
      return NextResponse.json(
        { error: "Сообщение обязательно" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: CHAT_SYSTEM },
      ...history
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({
          role: item.role,
          content: item.content,
        })),
      { role: "user", content: message },
    ];

    const selected = resolveChatModelConfig({
      modelId: body.modelId,
      message,
    });
    const modelConfig = selected.config;
    const reason = selected.reason;
    let responseText: string;
    let provider: ProviderId = modelConfig.provider;
    let providerLabel: string = PROVIDER_LABELS[modelConfig.provider];
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
      const wired = getModelConfig(modelConfig.id);
      console.log(
        `[ai] chat using provider=${wired.provider} model=${wired.modelId} catalog=${modelConfig.id} baseURL=${wired.baseURL}`
      );
    } catch (credError) {
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

    try {
      const completion = await withAiSlot(() =>
        chatWithProviders({
          config: modelConfig,
          messages,
          temperature: 0.6,
          max_tokens:
            modelConfig.id === "deepseek-chat" ||
            modelConfig.id === "gemini-3.1-flash-lite"
              ? 2048
              : 1500,
        })
      );
      responseText = completion.content;
      provider = completion.provider;
      providerLabel = completion.providerLabel;
    } catch (primaryError) {
      const queued = aiQueueErrorResponse(primaryError);
      if (queued) {
        return NextResponse.json(queued.body, { status: queued.status });
      }
      console.error("chat model error:", primaryError);
      return NextResponse.json(
        {
          error: `${modelConfig.name} сейчас недоступна. Выберите другую модель в списке.`,
          modelId: modelConfig.id,
          modelLabel: modelShortLabel(modelConfig.id),
          detail: humanizeUpstreamError(primaryError),
        },
        { status: 503 }
      );
    }

    const finalCost = getTokenCost(modelConfig.id);
    const spend = await chargeTokens(admin, profile, finalCost, {
      modelId: modelConfig.id,
      description: `Чат · ${modelConfig.name}`,
    });
    const status = buildStatusPayload({
      ...profile,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
    });

    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : crypto.randomUUID();

    const saved = await saveChatExchange({
      userId: auth.user.id,
      userMessage: message,
      assistantMessage: responseText,
      conversationId,
    });

    const costUsd = estimateCostUsd(modelConfig.id, {
      kind:
        modelConfig.id === "gpt-5.6-luna-chat" ? "chatComplex" : "chat",
      multiplier: modelConfig.costMultiplier,
    });

    return NextResponse.json({
      response: responseText,
      reply: responseText,
      model: modelConfig.modelId,
      modelId: modelConfig.id,
      modelLabel: modelShortLabel(modelConfig.id),
      modelReason: reason,
      provider,
      providerLabel,
      costUsd,
      costLabel: formatCostUsd(costUsd),
      token_cost: spend.charged,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
      conversationId:
        saved[0]?.conversation_id ?? conversationId,
      saved,
      remainingChat: status.token_balance,
    });
  } catch (error) {
    console.error("chat error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка чата" },
      { status: 500 }
    );
  }
}
