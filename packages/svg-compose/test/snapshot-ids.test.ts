import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { Stage } from "../src/canvas/stage";

const stages: Stage[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  while (stages.length) stages.pop()?.destroy();
  while (containers.length) containers.pop()?.remove();
});

async function makeStage(): Promise<Stage> {
  vi.resetModules();
  const { Stage } = await import("../src/canvas/stage");
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const stage = new Stage(container);
  stages.push(stage);
  return stage;
}

describe("snapshot ids", () => {
  it("repairs duplicate ids in restored drafts", async () => {
    const stage = await makeStage();
    stage.loadSnapshot({ svg: '<g id="n1"><rect id="n1" width="1" height="1"/></g>' });

    const ids = Array.from(stage.docGroup.querySelectorAll("[id]"), (element) => element.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not reuse ids restored from a previous session", async () => {
    const stage = await makeStage();
    stage.loadSnapshot({ svg: '<g id="n1"><rect id="n2" width="1" height="1"/></g>' });

    const { nextId } = await import("../src/doc/ids");
    expect(["n1", "n2"]).not.toContain(nextId());
  });
});
