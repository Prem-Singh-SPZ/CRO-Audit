/**
 * Simple promise semaphore so expensive work (Chromium + Gemini audits)
 * cannot stampede the process when the user opens several /analyzing tabs.
 */

export function createSemaphore(max: number): {
  run<T>(fn: () => Promise<T>): Promise<T>;
  active: () => number;
  waiting: () => number;
} {
  const limit = Math.max(1, Math.floor(max) || 1);
  let active = 0;
  const queue: Array<() => void> = [];

  function pump(): void {
    while (active < limit && queue.length > 0) {
      const next = queue.shift();
      if (next) next();
    }
  }

  async function acquire(): Promise<void> {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      queue.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  function release(): void {
    active = Math.max(0, active - 1);
    pump();
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
    active: () => active,
    waiting: () => queue.length,
  };
}

const maxAnalyze = Math.max(
  1,
  Number.parseInt(process.env.MAX_CONCURRENT_ANALYZES ?? "2", 10) || 2
);

/** At most N full audits at once (screenshot + PageSpeed + LLM). */
export const analyzeSemaphore = createSemaphore(maxAnalyze);
