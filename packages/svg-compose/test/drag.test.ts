import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { parseTransform } from "../src/doc/transform";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" fill="#e2e8f0"/>
</svg>`;

const stages: Stage[] = [];
afterEach(() => {
  while (stages.length) stages.pop()?.destroy();
});

const makeStage = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const stage = new Stage(container);
  stages.push(stage);
  stage.importSvg(SVG, "box");
  return { stage, wrapper: stage.docGroup.firstElementChild as SVGGElement };
};

const pointer = (target: EventTarget, type: string, x: number, y: number, ctrlKey = false) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, ctrlKey }),
  );

describe("drag to move", () => {
  it("moves the selected object and checks it out with undo", () => {
    const { stage, wrapper } = makeStage();
    const rect = wrapper.querySelector("rect")!;
    pointer(rect, "pointerdown", 100, 100);
    expect(stage.selectedIds).toEqual([wrapper.id]);
    pointer(stage.svg, "pointermove", 150, 130);
    expect(stage.dragState).toEqual({ mode: "move", count: 1 });
    pointer(stage.svg, "pointerup", 150, 130);
    expect(stage.dragState).toBeNull();

    // Original wrapper matrix is translate(40 40) scale(3.75); +50/+30 screen px.
    expect(parseTransform(wrapper.getAttribute("transform"))).toEqual([3.75, 0, 0, 3.75, 90, 70]);
    stage.undo();
    expect(parseTransform(stage.docGroup.firstElementChild?.getAttribute("transform"))).toEqual([
      3.75, 0, 0, 3.75, 40, 40,
    ]);
    expect(rect).toBeTruthy();
  });

  it("Ctrl+drag duplicates instead of moving the original", () => {
    const { stage, wrapper } = makeStage();
    const rect = wrapper.querySelector("rect")!;
    pointer(rect, "pointerdown", 100, 100, true);
    pointer(stage.svg, "pointermove", 160, 140, true);
    expect(stage.dragState).toEqual({ mode: "duplicate", count: 1 });
    pointer(stage.svg, "pointerup", 160, 140, true);

    // Ctrl+click selects the inner rect, so the copy is made inside its group.
    expect(wrapper.children).toHaveLength(2);
    const original = wrapper.children[0] as SVGGElement;
    const clone = wrapper.children[1] as SVGGElement;
    expect(clone.id).not.toBe(original.id);
    expect(original.getAttribute("transform")).toBeNull();
    expect(parseTransform(clone.getAttribute("transform"))).toEqual([1, 0, 0, 1, 60, 40]);
    expect(stage.selectedIds).toEqual([clone.id]);
  });

  it("a plain click does not add a history entry", () => {
    const { stage, wrapper } = makeStage();
    pointer(wrapper.querySelector("rect")!, "pointerdown", 100, 100);
    pointer(stage.svg, "pointerup", 100, 100);
    expect(stage.dragState).toBeNull();
    stage.undo();
    expect(stage.docGroup.children).toHaveLength(0);
  });
});
