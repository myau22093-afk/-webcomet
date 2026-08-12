/** Пауза между повторами, если сервер вернул 503 «очередь». */
const RETRY_DELAY_MS = 2500;

const DEFAULT_MAX_RETRIES = 240;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQueue503(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as { error?: string; retry?: boolean; queue?: unknown };
  if (d.retry) return true;
  if (d.queue) return true;
  const err = d.error?.toLowerCase() ?? "";
  return err.includes("очеред") || err.includes("queue");
}

/**
 * fetch с автоповтором при 503 очереди AI.
 * При бесконечной серверной очереди обычно не нужен — запрос ждёт слот в одном HTTP.
 */
export async function fetchWithAiQueue(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: {
    onQueued?: (attempt: number) => void;
    maxRetries?: number;
  }
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  let attempt = 0;

  while (true) {
    const res = await fetch(input, init);
    if (res.status !== 503) return res;

    const data = await res.json().catch(() => ({}));
    if (!isQueue503(data)) {
      return new Response(JSON.stringify(data), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    attempt += 1;
    opts?.onQueued?.(attempt);
    if (attempt >= maxRetries) {
      return new Response(JSON.stringify(data), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    await sleep(RETRY_DELAY_MS);
  }
}
