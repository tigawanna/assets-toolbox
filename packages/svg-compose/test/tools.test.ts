import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { EllipseTool, LineTool, PenTool, RectTool } from "../src/tools/shapes";

const stages: Stage[] = [];
afterEach(() => {
  while (stages.length) stages.pop()?.destroy();
});

const makeStage = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const stage = new Stage(container);
  stages.push(stage);
  return stage;
};

const pointer = (stage: Stage, type: string, clientX: number, clientY: number) =>
  stage.svg.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));

const drag = (stage: Stage, from: [number, number], to: [number, number]) => {
  pointer(stage, "pointerdown", ...from);
  pointer(stage, "pointermove", ...to);
  pointer(stage, "pointerup", ...to);
};

describe("drawing tools", () => {
  it("draws a rect and selects it", () => {
    const stage = makeStage();
    stage.setTool(new RectTool());
    expect(stage.activeToolId).toBe("rect");

    pointer(stage, "pointerdown", 10, 10);
    expect(stage.toolOverlay.querySelector(".tool-preview")).toBeTruthy();
    pointer(stage, "pointermove", 60, 70);
    expect(stage.toolOverlay.querySelector("rect")?.getAttribute("width")).toBe("50");
    pointer(stage, "pointerup", 60, 70);

    const rect = stage.docGroup.querySelector("rect")!;
    expect(rect.getAttribute("x")).toBe("10");
    expect(rect.getAttribute("width")).toBe("50");
    expect(rect.getAttribute("height")).toBe("60");
    expect(rect.id).toBeTruthy();
    expect(stage.selectedIds).toEqual([rect.id]);
    expect(stage.toolOverlay.querySelector(".tool-preview")).toBeNull();
    expect(stage.exportSvg()).toContain("<rect");

    stage.undo();
    expect(stage.docGroup.querySelector("rect")).toBeNull();
  });

  it("draws ellipses and lines", () => {
    const stage = makeStage();
    stage.setTool(new EllipseTool());
    drag(stage, [10, 10], [60, 70]);
    const ellipse = stage.docGroup.querySelector("ellipse")!;
    expect(ellipse.getAttribute("cx")).toBe("35");
    expect(ellipse.getAttribute("ry")).toBe("30");

    stage.setTool(new LineTool());
    drag(stage, [0, 0], [40, 30]);
    const line = stage.docGroup.querySelector("line")!;
    expect(line.getAttribute("x2")).toBe("40");
    expect(line.getAttribute("y2")).toBe("30");
    expect(line.getAttribute("stroke-width")).toBe("30");
  });

  it("pen tool finishes on Enter", () => {
    const stage = makeStage();
    stage.setTool(new PenTool());
    pointer(stage, "pointerdown", 10, 10);
    pointer(stage, "pointerdown", 60, 70);
    pointer(stage, "pointermove", 80, 90);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    const path = stage.docGroup.querySelector("path")!;
    expect(path.getAttribute("d")).toBe("M 10 10 L 60 70");
    expect(stage.selectedIds).toEqual([path.id]);
  });

  it("ignores tiny drags and clears previews on deactivate", () => {
    const stage = makeStage();
    stage.setTool(new RectTool());
    drag(stage, [10, 10], [11, 11]);
    expect(stage.docGroup.children).toHaveLength(0);

    pointer(stage, "pointerdown", 5, 5);
    expect(stage.toolOverlay.querySelector(".tool-preview")).toBeTruthy();
    stage.setTool(null);
    expect(stage.toolOverlay.querySelector(".tool-preview")).toBeNull();
    expect(stage.activeToolId).toBeNull();
  });
});
