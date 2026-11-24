import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { CornerTool, RotateTool } from "../src/tools/manipulate";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect x="10" y="10" width="100" height="100" fill="#a5b4fc"/>
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
  const rect = wrapper.querySelector("rect") as SVGGraphicsElement;
  rect.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 }) as DOMRect;
  stage.enterGroup(wrapper.id);
  stage.select(rect.id);
  return { stage, rect };
};

const pointer = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));

describe("corner radius", () => {
  it("rounds rects through the inspector and undoes in one step", () => {
    const { stage, rect } = makeStage();
    stage.setCornerRadius(18);
    expect(rect.getAttribute("rx")).toBe("18");
    expect(rect.getAttribute("ry")).toBe("18");
    expect(stage.getSelectionStyle()?.radius).toBe(18);
    stage.undo();
    expect(stage.docGroup.querySelector("rect")?.getAttribute("rx")).toBeNull();
  });

  it("corner tool drags a handle to change the radius", () => {
    const { stage, rect } = makeStage();
    stage.setTool(new CornerTool());
    const handle = stage.toolOverlay.querySelector(".manipulator-handle")!;
    expect(handle).toBeTruthy();
    pointer(handle, "pointerdown", 100, 0);
    pointer(stage.svg, "pointermove", 80, 20);
    pointer(stage.svg, "pointerup", 80, 20);
    expect(rect.getAttribute("rx")).toBe("20");
    stage.setTool(null);
  });
});

describe("rotation", () => {
  it("rotates around the object's centre and exposes the angle", () => {
    const { stage, rect } = makeStage();
    stage.setRotation(90);
    expect(stage.getSelectionStyle()?.rotation).toBeCloseTo(90, 4);
    expect(rect.getAttribute("data-rotation")).toBe("90");
    expect(stage.docGroup.querySelector("rect")?.getAttribute("data-rotation")).toBe("90");
    stage.undo();
    expect(stage.docGroup.querySelector("rect")?.getAttribute("data-rotation")).toBeNull();
  });

  it("rotate tool drags the handle around the centre", () => {
    const { stage } = makeStage();
    stage.setTool(new RotateTool());
    const handle = stage.toolOverlay.querySelector(".manipulator-handle")!;
    expect(handle).toBeTruthy();
    pointer(handle, "pointerdown", 50, -46);
    pointer(stage.svg, "pointermove", 150, 50);
    pointer(stage.svg, "pointerup", 150, 50);
    expect(stage.getSelectionStyle()?.rotation).toBeCloseTo(90, 0);
    stage.setTool(null);
  });
});
