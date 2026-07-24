/**
 * In-process AI concurrency limiter (per Node instance).
 * For multi-instance scale use Redis later; see SCALE.md.
 */

const maxConcurrent = Math.max(
  1,
  Number.parseInt(process.env.AI_MAX_CONCURRENT || "4", 10) || 4
);
const maxWaitMs = Math.max(
  5_000,
  Number.parseInt(process.env.AI_QUEUE_WAIT_MS || "120000", 10) || 120_000
);

let active = 0;
const waiters: Array<{
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}> = [];

export class AiQueueTimeoutError extends Error {
  constructor() {
    super(
      "Сейчас много генераций в очереди. Подождите около минуты и попробуйте снова."
    );
    this.name = "AiQueueTimeoutError";
  }
}

function pump() {
  while (active < maxConcurrent && waiters.length > 0) {
    const next = waiters.shift();
    if (!next) break;
    clearTimeout(next.timer);
    active += 1;
    next.resolve();
  }
}

function acquire(): Promise<void> {
  if (active < maxConcurrent) {
    active += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const entry = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const idx = waiters.indexOf(entry);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new AiQueueTimeoutError());
      }, maxWaitMs),
    };
    waiters.push(entry);
  });
}

function release() {
  active = Math.max(0, active - 1);
  pump();
}

export function getAiQueueStats() {
  return {
    active,
    waiting: waiters.length,
    maxConcurrent,
    maxWaitMs,
  };
}

export async function withAiSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export function aiQueueErrorResponse(error: unknown) {
  if (error instanceof AiQueueTimeoutError) {
    return {
      status: 503 as const,
      body: {
        error: error.message,
        queue: getAiQueueStats(),
      },
    };
  }
  return null;
}
