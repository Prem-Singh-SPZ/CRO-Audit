import { describe, expect, it } from "vitest";
import { createSemaphore } from "./concurrency";

describe("createSemaphore", () => {
  it("runs at most max tasks at once and drains the queue", async () => {
    const sem = createSemaphore(2);
    let concurrent = 0;
    let peak = 0;
    const work = async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await new Promise((r) => setTimeout(r, 40));
      concurrent -= 1;
    };
    await Promise.all([
      sem.run(work),
      sem.run(work),
      sem.run(work),
      sem.run(work),
    ]);
    expect(peak).toBe(2);
    expect(sem.active()).toBe(0);
    expect(sem.waiting()).toBe(0);
  });
});
