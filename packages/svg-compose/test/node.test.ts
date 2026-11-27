import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { KAPPA, makeSmooth, modelToPath, pathToModel, shapeToPathData } from "../src/doc/path";
import { NodeTool } from "../src/tools/node";

const stages: Stage[] = [];
afterEach(() => {
  while (stages.length) stages.pop()?.destroy();
});

const shape = (tag: string, attrs: Record<string, string>) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  return element;
};

const makeStage = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const stage = new Stage(container);
  stages.push(stage);
  return stage;
};

describe("shape to path", () => {
  it("converts rect, ellipse, line and polygon", () => {
    expect(shapeToPathData(shape("rect", { x: "1", y: "2", width: "3", height: "4" }))).toBe(
      "M 1 2 L 4 2 L 4 6 L 1 6 Z",
    );
    const ellipse = shapeToPathData(shape("ellipse", { cx: "10", cy: "10", rx: "4", ry: "4" }))!;
    expect(ellipse.match(/C /g)).toHaveLength(4);
    expect(ellipse).toContain(String(Number((KAPPA * 4).toFixed(3))));
    expect(shapeToPathData(shape("line", { x1: "0", y1: "0", x2: "5", y2: "6" }))).toBe(
      "M 0 0 L 5 6",
    );
    expect(shapeToPathData(shape("polygon", { points: "0,0 10,0 5,10" }))).toBe(
      "M 0 0 L 10 0 L 5 10 Z",
    );
  });

  it("round-trips a path through the node model", () => {
    const data = "M 0 0 C 2 4 6 4 8 0 L 10 10 Z";
    const model = pathToModel(data)!;
    expect(model.nodes).toHaveLength(3);
    expect(model.closed).toBe(true);
    expect(modelToPath(model)).toBe(data);
  });

  it("smoothing a converted rectangle's corners gives cubic handles", () => {
    const data = shapeToPathData(shape("rect", { x: "0", y: "0", width: "100", height: "100" }))!;
    const model = pathToModel(data)!;
    for (let index = 0; index < model.nodes.length; index += 1) makeSmooth(model, index);
    const rounded = modelToPath(model);
    expect(rounded.match(/C /g)).toHaveLength(4);
    expect(rounded).toContain(String(Number(((100 * KAPPA) / 2).toFixed(3))));
  });
});

describe("object to path + node tool", () => {
  it("replaces a shape with a path and can undo it", () => {
    const stage = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56"/></svg>`,
      "box",
    );
    const rect = stage.docGroup.querySelector("rect")!;
    stage.select(rect.id);
    stage.convertSelectionToPath();

    const path = stage.docGroup.querySelector("path")!;
    expect(path.id).toBe(rect.id);
    expect(path.getAttribute("d")).toContain("M 4 4");
    expect(stage.selectedIds).toEqual([path.id]);

    stage.undo();
    expect(stage.docGroup.querySelector("rect")).toBeTruthy();
    expect(stage.docGroup.querySelector("path")).toBeNull();
  });

  it("drags line endpoints with the node tool", () => {
    const stage = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><line x1="4" y1="8" x2="40" y2="16"/></svg>`,
      "line",
    );
    const line = stage.docGroup.querySelector("line")!;
    stage.select(line.id);
    stage.setTool(new NodeTool());

    const handles = stage.toolOverlay.querySelectorAll('[data-endpoint="1"]');
    expect(handles).toHaveLength(1);
    (handles[0] as SVGRectElement).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 40, clientY: 16 }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 52, clientY: 28 }),
    );
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

    expect(Number(line.getAttribute("x2"))).toBeGreaterThan(40);
    expect(Number(line.getAttribute("y2"))).toBeGreaterThan(16);
    expect(line.getAttribute("stroke-width")).toBeNull();
  });

  it("adds a new node from a segment dot", () => {
    const stage = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56"/></svg>`,
      "box",
    );
    stage.select(stage.docGroup.querySelector("rect")!.id);
    stage.convertSelectionToPath();
    const path = stage.docGroup.querySelector("path")!;
    stage.setTool(new NodeTool());

    const dots = stage.toolOverlay.querySelectorAll(".node-add");
    expect(dots).toHaveLength(4);
    (dots[0] as SVGCircleElement).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 50, clientY: 50 }),
    );
    stage.svg.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

    expect(pathToModel(path.getAttribute("d"))?.nodes).toHaveLength(5);
    expect(stage.toolOverlay.querySelectorAll(".node-add")).toHaveLength(5);
    stage.undo();
    expect(
      pathToModel(stage.docGroup.querySelector("path")?.getAttribute("d") ?? null)?.nodes,
    ).toHaveLength(4);
  });

  it("renders node handles and edits the path live", () => {
    const stage = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56"/></svg>`,
      "box",
    );
    stage.select(stage.docGroup.querySelector("rect")!.id);
    stage.convertSelectionToPath();
    const path = stage.docGroup.querySelector("path")!;
    stage.setTool(new NodeTool());

    expect(stage.toolOverlay.querySelectorAll(".node-point")).toHaveLength(4);
    const anchor = stage.toolOverlay.querySelector('[data-node="1"].node-point')!;
    anchor.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 50, clientY: 50 }),
    );
    stage.svg.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 60, clientY: 70 }),
    );
    stage.svg.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    // Pointer deltas are converted into the path's local space (scale 3.75).
    expect(path.getAttribute("d")).toContain("L 62.667 9.333");
    expect(stage.canUndo).toBe(true);

    // S toggles the focused node to smooth, creating cubic handles.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
    expect(path.getAttribute("d")).toContain("C ");
    stage.setTool(null);
    expect(stage.toolOverlay.children).toHaveLength(0);
  });
});
