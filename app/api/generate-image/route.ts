import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  assertHasTokens,
  buildStatusPayload,
  chargeTokens,
  formatBillingError,
  getOrCreateBillingProfile,
} from "@/lib/billing";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { humanizeUpstreamError } from "@/lib/apiErrors";
import { saveImage } from "@/lib/history";
import { requireAuth } from "@/lib/requireUser";
import {
  estimateCostUsd,
  formatCostUsd,
  modelShortLabel,
  resolveImageModelConfig,
} from "@/lib/models";
import { getModelConfig, imageWithProviders } from "@/lib/providers";
import { getTokenCost } from "@/lib/tokenConfig";
import { aiQueueErrorResponse, withAiSlot } from "@/lib/aiQueue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return auth.error!;

    const body = (await request.json()) as {
      prompt?: string;
      model?: string;
      modelId?: string;
    };

    const prompt = body.prompt?.trim() ?? "";
    const modelKey = body.modelId?.trim() || body.model?.trim() || "gpt-image-2";

    if (!prompt) {
      return NextResponse.json({ error: "Промпт обязателен" }, { status: 400 });
    }

    let modelConfig;
    try {
      modelConfig = resolveImageModelConfig(modelKey);
    } catch {
      return NextResponse.json(
        { error: "Неизвестная модель изображения" },
        { status: 400 }
      );
    }

    if (!modelConfig || modelConfig.type !== "image") {
      return NextResponse.json(
        { error: "Неизвестная модель изображения" },
        { status: 400 }
      );
    }

    try {
      const wired = getModelConfig(modelConfig.id);
      console.log(
        `[ai] generate-image using provider=${wired.provider} model=${wired.modelId} catalog=${modelConfig.id} baseURL=${wired.baseURL}`
      );
    } catch (credError) {
      return NextResponse.json(
        {
          error:
            credError instanceof Error
              ? credError.message
              : "Провайдер не настроен",
        },
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

    let result;
    try {
      result = await withAiSlot(() =>
        imageWithProviders({
          config: modelConfig,
          prompt,
        })
      );
    } catch (upstreamError) {
      const queued = aiQueueErrorResponse(upstreamError);
      if (queued) {
        return NextResponse.json(queued.body, { status: queued.status });
      }
      console.error("generate-image upstream:", upstreamError);
      const raw =
        upstreamError instanceof Error
          ? upstreamError.message
          : "Ошибка генерации изображения";
      return NextResponse.json(
        {
          error: humanizeUpstreamError(raw),
          code: "upstream_rejected",
        },
        { status: 500 }
      );
    }

    let imageUrl: string | null = result.url ?? null;

    if (!imageUrl && result.b64_json) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const fileName = `ai_${Date.now()}.png`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, Buffer.from(result.b64_json, "base64"));
      imageUrl = `/uploads/${fileName}`;
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Модель не вернула изображение" },
        { status: 500 }
      );
    }

    const spend = await chargeTokens(admin, profile, tokenCost, {
      modelId: modelConfig.id,
      description: `Картинка · ${modelConfig.name}`,
    });
    const status = buildStatusPayload({
      ...profile,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
    });

    const saved = await saveImage({
      userId: auth.user.id,
      prompt,
      imageUrl,
      model: modelConfig.id,
    });

    const costUsd = estimateCostUsd(modelConfig.id, {
      kind: "image",
      multiplier: modelConfig.costMultiplier,
    });

    return NextResponse.json({
      url: imageUrl,
      model: modelConfig.id,
      modelId: modelConfig.id,
      modelLabel: modelShortLabel(modelConfig.id),
      provider: result.provider,
      providerLabel: result.providerLabel,
      usedFallback: result.usedFallback,
      costUsd,
      costLabel: formatCostUsd(costUsd),
      token_cost: spend.charged,
      token_balance: spend.balance,
      total_tokens_used: spend.totalUsed,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? new Date().toISOString(),
      remainingImages: status.token_balance,
    });
  } catch (error) {
    console.error("generate-image error:", error);
    return NextResponse.json(
      { error: formatBillingError(error) || "Ошибка генерации изображения" },
      { status: 500 }
    );
  }
}
