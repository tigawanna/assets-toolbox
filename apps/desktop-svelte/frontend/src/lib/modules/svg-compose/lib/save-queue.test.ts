import { describe, expect, it } from "vite-plus/test";

import { createSaveQueue } from "./save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("save queue", () => {
  it("does not start a newer save until the previous save settles", async () => {
    const queue = createSaveQueue();
    const first = deferred<string>();
    const second = deferred<string>();
    const order: string[] = [];

    const firstSave = queue(async () => {
      order.push("first:start");
      const value = await first.promise;
      order.push("first:end");
      return value;
    });
    const secondSave = queue(async () => {
      order.push("second:start");
      const value = await second.promise;
      order.push("second:end");
      return value;
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    first.resolve("old");
    await firstSave;
    await Promise.resolve();
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
    second.resolve("new");
    await expect(secondSave).resolves.toBe("new");
  });

  it("continues after a save rejects", async () => {
    const queue = createSaveQueue();
    const failed = queue(async () => {
      throw new Error("disk full");
    });
    await expect(failed).rejects.toThrow("disk full");
    await expect(queue(async () => "saved")).resolves.toBe("saved");
  });
});
