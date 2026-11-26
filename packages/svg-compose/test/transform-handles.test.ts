import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { parseTransform } from "../src/doc/transform";
import { CornerTool } from "../src/tools/manipulate";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" fill="#a5b4fc"/>
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
  const wrapper = stage.docGroup.firstElementChild as SVGGElement;
  wrapper.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 }) as DOMRect;
  stage.select(wrapper.id);
  return { stage, wrapper };
};

const pointer = (target: EventTarget, type: string, x: number, y: number, shiftKey = false) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, shiftKey }),
  );

describe("selection handles", () => {
  it("shows four scale corners and a rotate handle for a single selection", () => {
    const { stage } = makeStage();
    expect(stage.overlay.querySelectorAll(".overlay-handle[data-transform='scale']")).toHaveLength(
      4,
    );
    expect(stage.overlay.querySelector(".overlay-handle[data-direction='se']")).toBeTruthy();
    expect(stage.overlay.querySelector(".overlay-rotate[data-transform='rotate']")).toBeTruthy();
  });

  it("hides generic handles while a transform tool is active", () => {
    const { stage } = makeStage();
    stage.setTool(new CornerTool());
    expect(stage.overlay.querySelectorAll(".overlay-handle")).toHaveLength(0);
    expect(stage.overlay.querySelector(".overlay-rotate")).toBeNull();
    stage.setTool(null);
    expect(stage.overlay.querySelectorAll(".overlay-handle")).toHaveLength(4);
  });

  it("lets a handle tool select another object when clicking away from its handle", () => {
    const { stage, wrapper } = makeStage();
    stage.setTool(new CornerTool());
    stage.importSvg(SVG, "second");
    const rect = stage.docGroup.firstElementChild!.querySelector("rect")!;
    pointer(rect, "pointerdown", 10, 10);
    expect(stage.selectedIds).toEqual([wrapper.id]);
  });

  it("hides handles for multi-selection", () => {
    const { stage, wrapper } = makeStage();
    stage.importSvg(SVG, "second");
    const second = stage.docGroup.lastElementChild as SVGGElement;
    stage.select(wrapper.id);
    stage.select(second.id, { additive: true });
    expect(stage.overlay.querySelectorAll(".overlay-handle")).toHaveLength(0);
  });

  it("dragging a corner scales around the opposite corner", () => {
    const { stage, wrapper } = makeStage();
    const handle = stage.overlay.querySelector(".overlay-handle[data-direction='se']")!;
    pointer(handle, "pointerdown", 100, 100);
    pointer(stage.svg, "pointermove", 150, 150);
    pointer(stage.svg, "pointerup", 150, 150);
    expect(parseTransform(wrapper.getAttribute("transform"))).toEqual([3.6, 0, 0, 3.6, 60, 60]);
    stage.undo();
    expect(parseTransform(stage.docGroup.firstElementChild?.getAttribute("transform"))).toEqual([
      2.4, 0, 0, 2.4, 40, 40,
    ]);
  });

  it("keeps gentle multi-step corner drags proportional and undoable", () => {
    const { stage, wrapper } = makeStage();
    const handle = stage.overlay.querySelector(".overlay-handle[data-direction='se']")!;
    pointer(handle, "pointerdown", 100, 100);
    pointer(stage.svg, "pointermove", 120, 120);
    pointer(stage.svg, "pointermove", 150, 150);
    pointer(stage.svg, "pointerup", 150, 150);
    expect(parseTransform(wrapper.getAttribute("transform"))).toEqual([3.6, 0, 0, 3.6, 60, 60]);
    stage.undo();
    expect(parseTransform(stage.docGroup.firstElementChild?.getAttribute("transform"))).toEqual([
      2.4, 0, 0, 2.4, 40, 40,
    ]);
  });

  it("does not add duplicate undo steps for unchanged checkpoints", () => {
    const { stage } = makeStage();
    stage.undo();
    expect(stage.canUndo).toBe(false);
    stage.checkpoint();
    stage.checkpoint();
    stage.undo();
    expect(stage.canUndo).toBe(false);
  });

  it("dragging the top handle rotates the object", () => {
    const { stage } = makeStage();
    const handle = stage.overlay.querySelector(".overlay-rotate")!;
    pointer(handle, "pointerdown", 50, -40);
    pointer(stage.svg, "pointermove", 150, 50);
    pointer(stage.svg, "pointerup", 150, 50);
    expect(stage.getSelectionStyle()?.rotation).toBeCloseTo(90, 0);
    stage.undo();
    stage.select(stage.docGroup.firstElementChild!.id);
    expect(stage.getSelectionStyle()?.rotation).toBeCloseTo(0, 4);
  });
});
