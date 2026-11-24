import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";

const stages: Stage[] = [];
afterEach(() => {
  while (stages.length) stages.pop()?.destroy();
});

const makeStage = () => {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
  document.body.append(container);
  const stage = new Stage(container);
  stages.push(stage);
  return { stage, container };
};

const viewBox = (stage: Stage) => (stage.svg.getAttribute("viewBox") ?? "").split(" ").map(Number);

describe("recenter", () => {
  it("centres the whole document when nothing is selected", () => {
    const { stage } = makeStage();
    stage.docGroup.getBBox = () => ({ x: 100, y: 100, width: 200, height: 100 }) as DOMRect;
    stage.recenter();
    expect(viewBox(stage)).toEqual([-200, -150, 800, 600]);
  });

  it("centres the selection when objects are selected", () => {
    const { stage } = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>`,
      "box",
    );
    const wrapper = stage.docGroup.firstElementChild as SVGGElement;
    wrapper.getBBox = () => ({ x: 20, y: 30, width: 40, height: 50 }) as DOMRect;
    stage.recenter();
    expect(viewBox(stage)).toEqual([-360, -245, 800, 600]);
  });

  it("selectionBox unions multiple selected objects", () => {
    const { stage } = makeStage();
    stage.importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect id="a" width="10" height="10"/><rect id="b" x="50" y="30" width="10" height="10"/></svg>`,
      "two",
    );
    const wrapper = stage.docGroup.firstElementChild as SVGGElement;
    const a = wrapper.querySelector("#a") as SVGGraphicsElement;
    const b = wrapper.querySelector("#b") as SVGGraphicsElement;
    a.getBBox = () => ({ x: 5, y: 5, width: 10, height: 10 }) as DOMRect;
    b.getBBox = () => ({ x: 60, y: 35, width: 10, height: 10 }) as DOMRect;
    stage.enterGroup(wrapper.id);
    stage.select(a.id);
    stage.select(b.id, { additive: true });
    expect(stage.selectionBox()).toEqual({ x: 5, y: 5, width: 65, height: 40 });
  });

  it("emits so the HUD can announce the action", () => {
    const { stage } = makeStage();
    stage.docGroup.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 }) as DOMRect;
    let calls = 0;
    stage.subscribe(() => (calls += 1));
    stage.recenter();
    expect(calls).toBeGreaterThan(0);
  });
});
