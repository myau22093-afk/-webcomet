import { NextResponse } from "next/server";
import {
  assertHasTokens,
  buildStatusPayload,
  chargeTokens,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import {
  estimateCostUsd,
  formatCostUsd,
  MODELS,
  modelShortLabel,
} from "@/lib/models";
import { parseSiteJson } from "@/lib/parseSiteJson";
import { promptraChatCompletion } from "@/lib/promptra";
import { requireAuth } from "@/lib/requireUser";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTokenCost } from "@/lib/tokenConfig";
import { aiQueueErrorResponse, withAiSlot } from "@/lib/aiQueue";

export const runtime = "nodejs";
export const maxDuration = 600;

const EDIT_SYSTEM = `Ты веб-разработчик. Пользователь даёт текущий код сайта и правки.
ОБЯЗАТЕЛЬНО внеси запрошенные изменения в код. Не возвращай код без изменений.
Верни ПОЛНЫЙ обновлённый код в JSON: {"html":"...","css":"...","js":"..."}.
html — разметка body (без doctype/html/head), css и js — отдельные поля.
Без markdown и пояснений. Сохраняй то, что не просили менять.`;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      html?: string;
      css?: string;
      js?: string;
      editPrompt?: string;
    };

    const html = body.html ?? "";
    const css = body.css ?? "";
    const js = body.js ?? "";
    const editPrompt = body.editPrompt?.trim() ?? "";

    if (!editPrompt) {
      return NextResponse.json(
        { error: "Опишите, что изменить" },
        { status: 400 }
      );
    }
    if (!html.trim()) {
      return NextResponse.json(
        { error: "Нет текущего HTML для правки" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);
    const tokenCost = getTokenCost("gpt-5.6-terra");

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

    const model = MODELS.siteEdit;
    const userPrompt = `Вот текущий код сайта. Внеси следующие изменения: ${editPrompt}. Верни полный обновлённый код в формате JSON {html, css, js}.

HTML:
${html}

CSS:
${css}

JS:
${js}`;

    let content: string;
    try {
      content = await withAiSlot(() =>
        promptraChatCompletion({
          model,
          messages: [
            { role: "system", content: EDIT_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 10000,
          stream: true,
          retries: 2,
        })
      );
    } catch (error) {
      const queued = aiQueueErrorResponse(error);
      if (queued) {
        return NextResponse.json(queued.body, { status: queued.status });
      }
      console.error("edit-site model error:", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Ошибка правки",
          model,
          modelLabel: modelShortLabel(model),
        },
        { status: 500 }
      );
    }

    let parts: { html: string; css: string; js: string };
    try {
      parts = parseSiteJson(content);
    } catch (error) {
      console.error("edit-site parse error:", error, content.slice(0, 500));
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Не удалось разобрать ответ модели",
        },
        { status: 500 }
      );
    }

    const spend = await chargeTokens(admin, profile, tokenCost, {
      modelId: "gpt-5.6-luna",
      description: "Правка сайта",
    });
    const status = buildStatusPayload({
      ...profile,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
    });
    const costUsd = estimateCostUsd(model, { kind: "siteEdit" });

    return NextResponse.json({
      ...parts,
      model,
      modelLabel: modelShortLabel(model),
      modelReason: "правка сайта → GPT-5.6 Luna",
      costUsd,
      costLabel: formatCostUsd(costUsd),
      token_cost: spend.charged,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
      remaining: status.token_balance,
    });
  } catch (error) {
    console.error("edit-site error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка правки сайта" },
      { status: 500 }
    );
  }
}
