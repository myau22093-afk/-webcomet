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

    const fallbackIds = [
      modelConfig.id,
      "gemini-3.1-flash-image",
      "gpt-image-2",
      "gemini-3-pro-image",
    ].filter((id, i, arr) => arr.indexOf(id) === i);

    const admin = createAdminClient();
    const profile = await getOrCreateBillingProfile(admin, auth.user);

    let result: Awaited<ReturnType<typeof imageWithProviders>> | null = null;
    let usedConfig = modelConfig;
    let lastUpstreamError: unknown = null;

    for (const candidateId of fallbackIds) {
      const candidate = resolveImageModelConfig(candidateId);
      if (!candidate || candidate.type !== "image") continue;
      const tokenCost = getTokenCost(candidate.id);
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
        getModelConfig(candidate.id);
      } catch {
        continue;
      }

      try {
        console.log(
          `[ai] generate-image try catalog=${candidate.id} model=${candidate.modelId}`
        );
        result = await withAiSlot(() =>
          imageWithProviders({
            config: candidate,
            prompt,
          })
        );
        usedConfig = candidate;
        break;
      } catch (upstreamError) {
        const queued = aiQueueErrorResponse(upstreamError);
        if (queued) {
          return NextResponse.json(queued.body, { status: queued.status });
        }
        lastUpstreamError = upstreamError;
        console.error(`generate-image failed for ${candidate.id}:`, upstreamError);
      }
    }

    if (!result) {
      const raw =
        lastUpstreamError instanceof Error
          ? lastUpstreamError.message
          : "Ошибка генерации изображения";
      return NextResponse.json(
        {
          error: humanizeUpstreamError(raw),
          code: "upstream_rejected",
        },
        { status: 500 }
      );
    }

    modelConfig = usedConfig;
    const tokenCost = getTokenCost(modelConfig.id);

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
