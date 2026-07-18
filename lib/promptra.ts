import { getModelByUpstreamId } from "@/lib/models";
import { chatWithProviders } from "@/lib/providers";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

/** @deprecated Prefer chatWithProviders + ModelConfig. Kept for edit-site и legacy. */
export async function promptraChatCompletion(options: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  retries?: number;
}): Promise<string> {
  const fromCatalog = getModelByUpstreamId(options.model);
  const config = fromCatalog ?? {
    id: options.model,
    name: options.model,
    provider: "promptra" as const,
    modelId: options.model,
    type: "site" as const,
    costMultiplier: 1,
    fallbackProviders: ["proxyapi"] as const,
  };

  const result = await chatWithProviders({
    config: {
      ...config,
      fallbackProviders: [...(config.fallbackProviders ?? [])],
    },
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    stream: options.stream,
  });

  return result.content;
}
