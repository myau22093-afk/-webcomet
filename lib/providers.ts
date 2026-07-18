import type { ChatMessage } from "@/lib/promptra";
import {
  getModelById,
  type ModelConfig,
  type ProviderId,
  type ResolvedModelCredentials,
  PROVIDER_LABELS,
} from "@/lib/models";

export type ProviderCredentials = {
  id: ProviderId;
  label: string;
  apiKey: string;
  baseUrl: string;
};

export type ProviderHealth = {
  id: ProviderId;
  label: string;
  configured: boolean;
  ok: boolean;
};

function envKey(provider: ProviderId): { key: string; url: string } {
  if (provider === "promptra") {
    return {
      key: process.env.PROMPTRA_API_KEY ?? "",
      url: process.env.PROMPTRA_BASE_URL ?? "",
    };
  }
  if (provider === "proxyapi") {
    return {
      key: process.env.PROXYAPI_API_KEY ?? "",
      url:
        process.env.PROXYAPI_BASE_URL ??
        "https://openai.api.proxyapi.ru/v1",
    };
  }
  return { key: "", url: "" };
}

export function getProviderCredentials(
  provider: ProviderId
): ProviderCredentials | null {
  const { key, url } = envKey(provider);
  const apiKey = key.trim();
  const baseUrl = url.trim().replace(/\/$/, "");
  if (!apiKey || !baseUrl) return null;
  return {
    id: provider,
    label: PROVIDER_LABELS[provider],
    apiKey,
    baseUrl,
  };
}

/** Единая функция: каталог → provider + modelId + baseURL + apiKey */
export function getModelConfig(catalogId: string): ResolvedModelCredentials {
  const config = getModelById(catalogId);
  if (!config) {
    throw new Error(`Неизвестная модель: ${catalogId}`);
  }

  const primary = getProviderCredentials(config.provider);
  if (primary) {
    console.log(
      `[ai] getModelConfig id=${config.id} provider=${config.provider} model=${config.modelId}`
    );
    return {
      provider: config.provider,
      modelId: config.modelId,
      baseURL: primary.baseUrl,
      apiKey: primary.apiKey,
      config,
    };
  }

  for (const fb of config.fallbackProviders ?? []) {
    const creds = getProviderCredentials(fb);
    if (creds) {
      console.warn(
        `[ai] getModelConfig: ${config.provider} offline → ${fb} for ${config.id}`
      );
      return {
        provider: fb,
        modelId: config.modelId,
        baseURL: creds.baseUrl,
        apiKey: creds.apiKey,
        config: { ...config, provider: fb },
      };
    }
  }

  throw new Error(
    `Нет ключа для провайдера «${PROVIDER_LABELS[config.provider]}» (модель ${config.name})`
  );
}

export function listProviderHealth(): ProviderHealth[] {
  const ids: ProviderId[] = ["promptra", "proxyapi"];
  return ids.map((id) => {
    const creds = getProviderCredentials(id);
    return {
      id,
      label: PROVIDER_LABELS[id],
      configured: Boolean(creds),
      ok: Boolean(creds),
    };
  });
}

function buildProviderChain(config: ModelConfig): ProviderId[] {
  const chain: ProviderId[] = [config.provider];
  for (const fb of config.fallbackProviders ?? []) {
    if (!chain.includes(fb)) chain.push(fb);
  }
  // Always try remaining configured providers last
  for (const id of ["promptra", "proxyapi"] as ProviderId[]) {
    if (!chain.includes(id)) chain.push(id);
  }
  return chain.filter((id) => getProviderCredentials(id));
}

function extractMessageContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const message = (
    data as { choices?: Array<{ message?: Record<string, unknown> }> }
  ).choices?.[0]?.message;
  if (!message) return "";

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (
    typeof message.reasoning_content === "string" &&
    message.reasoning_content.trim()
  ) {
    return message.reasoning_content.trim();
  }
  return "";
}

function networkErrorMessage(provider: ProviderId, error: unknown): string {
  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { code?: string; message?: string } }).cause
      : undefined;
  const code = cause?.code ?? "";
  const detail = cause?.message ?? (error instanceof Error ? error.message : "");

  if (
    code === "UND_ERR_SOCKET" ||
    detail.includes("other side closed") ||
    detail.includes("fetch failed") ||
    detail.includes("AbortError") ||
    detail.includes("timeout")
  ) {
    return `${PROVIDER_LABELS[provider]}: таймаут или обрыв соединения`;
  }

  return detail || `${PROVIDER_LABELS[provider]}: сетевая ошибка`;
}

function isRetryableUpstream(status: number, message: string): boolean {
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("таймаут") ||
    m.includes("обрыв") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("socket")
  );
}

async function readSseContent(response: Response): Promise<string> {
  if (!response.body) throw new Error("Пустой поток ответа");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string") content += delta;
      } catch {
        // skip
      }
    }
  }

  return content.trim();
}

function usesMaxCompletionTokens(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("gpt-5") ||
    id.includes("o1") ||
    id.includes("o3") ||
    id.includes("o4")
  );
}

function omitsTemperature(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("claude-fable") ||
    id.includes("claude-sonnet-5") ||
    id.includes("gpt-5")
  );
}

async function chatOnce(options: {
  creds: ProviderCredentials;
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  const payload: Record<string, unknown> = {
    model: options.modelId,
    messages: options.messages,
    stream: options.stream,
  };

  if (!omitsTemperature(options.modelId) && options.temperature != null) {
    payload.temperature = options.temperature;
  }

  if (options.max_tokens != null) {
    if (usesMaxCompletionTokens(options.modelId)) {
      payload.max_completion_tokens = options.max_tokens;
    } else {
      payload.max_tokens = options.max_tokens;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${options.creds.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.creds.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(networkErrorMessage(options.creds.id, error));
  } finally {
    clearTimeout(timer);
  }

  if (options.stream) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = `${options.creds.label} error: ${response.status}`;
      try {
        const data = JSON.parse(text) as {
          error?: { message?: string };
          message?: string;
        };
        message = data?.error?.message ?? data?.message ?? message;
      } catch {
        if (text) message = text.slice(0, 300);
      }
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const content = await readSseContent(response);
    if (!content) throw new Error("Пустой ответ от модели");
    return content;
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      text
        ? `${options.creds.label} вернул не-JSON: ${text.slice(0, 200)}`
        : `Пустой ответ от ${options.creds.label}`
    );
  }

  if (!response.ok) {
    const root = data as {
      error?: { message?: string };
      message?: string;
    } | null;
    const err = new Error(
      root?.error?.message ??
        root?.message ??
        `${options.creds.label} error: ${response.status}`
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  const content = extractMessageContent(data);
  if (!content) throw new Error("Пустой ответ от модели");
  return content;
}

export type ChatCompletionResult = {
  content: string;
  provider: ProviderId;
  providerLabel: string;
  modelId: string;
  catalogId: string;
  usedFallback: boolean;
};

export async function chatWithProviders(options: {
  config: ModelConfig;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  timeoutMs?: number;
}): Promise<ChatCompletionResult> {
  const useStream =
    options.stream ??
    Boolean(options.max_tokens && options.max_tokens >= 2000);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const chain = buildProviderChain(options.config);

  if (chain.length === 0) {
    throw new Error("Нет настроенных AI-провайдеров в .env.local");
  }

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    const creds = getProviderCredentials(provider);
    if (!creds) continue;

    console.log(
      `[ai] chat try provider=${provider} model=${options.config.modelId} catalog=${options.config.id}`
    );

    try {
      const content = await chatOnce({
        creds,
        modelId: options.config.modelId,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: useStream,
        timeoutMs,
      });

      console.log(
        `[ai] chat ok provider=${provider} model=${options.config.modelId}`
      );

      return {
        content,
        provider,
        providerLabel: creds.label,
        modelId: options.config.modelId,
        catalogId: options.config.id,
        usedFallback: i > 0,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status)
          : 0;

      console.error(
        `[ai] chat fail provider=${provider} status=${status || "-"}:`,
        message
      );

      if (!isRetryableUpstream(status, message) && i === 0 && chain.length > 1) {
        // non-retryable on primary still try fallbacks for 5xx-class only;
        // for 4xx model-not-found still try next provider
        if (status > 0 && status < 500 && status !== 408 && status !== 429) {
          // 400/401/403 — try next only if model-related; still attempt fallbacks
          continue;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Все провайдеры недоступны");
}

export type ImageGenerationResult = {
  url?: string;
  b64_json?: string;
  provider: ProviderId;
  providerLabel: string;
  modelId: string;
  catalogId: string;
  usedFallback: boolean;
  raw?: unknown;
};

async function imageOnce(options: {
  creds: ProviderCredentials;
  modelId: string;
  prompt: string;
  timeoutMs: number;
}): Promise<{ url?: string; b64_json?: string; raw: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${options.creds.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.creds.apiKey}`,
      },
      body: JSON.stringify({
        model: options.modelId,
        prompt: options.prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(networkErrorMessage(options.creds.id, error));
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const raw =
      data?.error?.message ??
      data?.message ??
      `${options.creds.label} image error: ${response.status}`;
    const err = new Error(String(raw)) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  const item = data?.data?.[0];
  return {
    url: item?.url,
    b64_json: item?.b64_json,
    raw: data,
  };
}

export async function imageWithProviders(options: {
  config: ModelConfig;
  prompt: string;
  timeoutMs?: number;
}): Promise<ImageGenerationResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const chain = buildProviderChain(options.config);

  if (chain.length === 0) {
    throw new Error("Нет настроенных AI-провайдеров в .env.local");
  }

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    const creds = getProviderCredentials(provider);
    if (!creds) continue;

    console.log(
      `[ai] image try provider=${provider} model=${options.config.modelId} catalog=${options.config.id}`
    );

    try {
      const result = await imageOnce({
        creds,
        modelId: options.config.modelId,
        prompt: options.prompt,
        timeoutMs,
      });

      if (!result.url && !result.b64_json) {
        throw new Error("Модель не вернула изображение");
      }

      console.log(
        `[ai] image ok provider=${provider} model=${options.config.modelId}`
      );

      return {
        url: result.url,
        b64_json: result.b64_json,
        provider,
        providerLabel: creds.label,
        modelId: options.config.modelId,
        catalogId: options.config.id,
        usedFallback: i > 0,
        raw: result.raw,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ai] image fail provider=${provider}:`, message);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Все провайдеры недоступны для изображений");
}
