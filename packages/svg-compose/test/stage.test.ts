import { describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { HistoryStack } from "../src/history/stack";

const BOX_PLUS_CIRCLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="6" fill="#e2e8f0"/>
  <circle cx="32" cy="32" r="12" fill="#0f172a"/>
</svg>`;

const makeStage = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const stage = new Stage(container);
  return { container, stage };
};

describe("HistoryStack", () => {
  const harness = () => {
    let doc = "empty";
    const stack = new HistoryStack(
      () => doc,
      (snapshot) => {
        doc = snapshot;
      },
    );
    return { read: () => doc, write: (next: string) => (doc = next), stack };
  };

  it("undoes and redoes mutations", () => {
    const { read, write, stack } = harness();
    stack.checkpoint();
    write("one");
    stack.checkpoint();
    write("two");

    expect(stack.canUndo).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(read()).toBe("one");
    expect(stack.redo()).toBe(true);
    expect(read()).toBe("two");
    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(read()).toBe("empty");
    expect(stack.undo()).toBe(false);
  });

  it("clears the redo branch after a new checkpoint", () => {
    const { read, write, stack } = harness();
    stack.checkpoint();
    write("one");
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.checkpoint();
    expect(stack.canRedo).toBe(false);
    expect(read()).toBe("empty");
  });

  it("caps the undo depth", () => {
    let doc = "0";
    const stack = new HistoryStack(
      () => doc,
      (next) => {
        doc = next;
      },
      3,
    );
    for (let i = 1; i <= 10; i += 1) {
      stack.checkpoint();
      doc = String(i);
    }
    let steps = 0;
    while (stack.undo()) steps += 1;
    expect(steps).toBe(3);
  });
});

describe("Stage", () => {
  it("mounts a live svg with separate doc and overlay groups", () => {
    const { container, stage } = makeStage();
    expect(container.querySelector("svg")).toBe(stage.svg);
    expect(stage.svg.querySelector("#doc")).toBe(stage.docGroup);
    expect(stage.svg.querySelector("#overlay")).toBe(stage.overlay);
    expect(stage.overlay.getAttribute("pointer-events")).toBe("none");
    stage.destroy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("imports, exports, undoes and redoes", () => {
    const { stage } = makeStage();
    expect(stage.exportSvg()).not.toContain("<rect");

    stage.importSvg(BOX_PLUS_CIRCLE, "box-plus-circle");
    const imported = stage.exportSvg();
    expect(imported).toContain("<rect");
    expect(imported).toContain("<circle");
    expect(stage.canUndo).toBe(true);

    stage.undo();
    expect(stage.exportSvg()).not.toContain("<rect");
    expect(stage.canRedo).toBe(true);

    stage.redo();
    expect(stage.exportSvg()).toContain("<circle");
    stage.destroy();
  });

  it("keeps the overlay out of exports", () => {
    const { stage } = makeStage();
    stage.importSvg(BOX_PLUS_CIRCLE, "box");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    marker.id = "selection-box";
    stage.overlay.append(marker);
    expect(stage.exportSvg()).not.toContain("selection-box");
    stage.destroy();
  });

  it("rejects bad imports without touching the document", () => {
    const { stage } = makeStage();
    expect(() => stage.importSvg("<html></html>", "nope")).toThrow();
    expect(stage.exportSvg()).not.toContain("<html");
    stage.destroy();
  });

  it("tracks zoom through subscribe", () => {
    const { stage } = makeStage();
    const seen: number[] = [];
    const unsubscribe = stage.subscribe(() => seen.push(stage.zoomLevel));
    stage.importSvg(BOX_PLUS_CIRCLE, "box");
    unsubscribe();
    expect(seen.length).toBeGreaterThan(0);
    expect(stage.zoomLevel).toBeGreaterThan(0);
    stage.destroy();
  });
});

/**
 * Acceptance workflow (Phase 1+2 scope): import the box-plus-circle icon,
 * confirm its inner shapes survive as structured elements, and export.
 * Later phases extend this with pull-out / drop-circle / group steps.
 */
describe("box-plus-circle workflow", () => {
  it("import → inspect → export keeps both shapes editable in the tree", () => {
    const { stage } = makeStage();
    stage.importSvg(BOX_PLUS_CIRCLE, "box-plus-circle");

    const wrapper = stage.docGroup.firstElementChild as SVGGElement;
    expect(wrapper.getAttribute("data-name")).toBe("box-plus-circle");
    expect(wrapper.querySelector("rect")).toBeTruthy();
    expect(wrapper.querySelector("circle")).toBeTruthy();

    const out = stage.exportSvg();
    expect(out).toContain("<rect");
    expect(out).toContain("<circle");
    expect(out).toMatch(/viewBox="/);
    stage.destroy();
  });
});
