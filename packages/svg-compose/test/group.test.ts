import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { parseTransform } from "../src/doc/transform";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect id="box" x="4" y="4" width="56" height="56" fill="#e2e8f0"/>
  <g id="plus"><path d="M32 16 V48 M16 32 H48" stroke="#0f172a"/></g>
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
  stage.importSvg(SVG, "box-plus-circle");
  const wrapper = stage.docGroup.firstElementChild as SVGGElement;
  return {
    stage,
    wrapper,
    rect: wrapper.querySelector("#box")!,
    plus: wrapper.querySelector("#plus")!,
    path: wrapper.querySelector("path")!,
  };
};

describe("group / ungroup", () => {
  it("groups selected siblings into a new group", () => {
    const { stage, wrapper, rect, plus } = makeStage();
    stage.select(rect.id);
    stage.select(plus.id, { additive: true });
    stage.groupSelection();

    expect(wrapper.children).toHaveLength(0);
    const group = stage.docGroup.lastElementChild as SVGGElement;
    expect(group.tagName.toLowerCase()).toBe("g");
    expect(Array.from(group.children)).toEqual([rect, plus]);
    expect(stage.selectedIds).toEqual([group.id]);
    expect(stage.exportSvg()).toContain('id="plus"');
  });

  it("bakes the group transform into children on ungroup", () => {
    const { stage, rect, plus } = makeStage();
    stage.select(rect.id);
    stage.select(plus.id, { additive: true });
    stage.groupSelection();
    const groupId = stage.selectedIds[0]!;
    const group = stage.docGroup.querySelector(`[id="${groupId}"]`) as SVGGElement;
    group.setAttribute("transform", "translate(10 20) scale(2)");

    stage.select(groupId);
    stage.ungroupSelection();

    expect(stage.docGroup.querySelector(`[id="${groupId}"]`)).toBeNull();
    expect(stage.docGroup.contains(rect)).toBe(true);
    expect(stage.docGroup.contains(plus)).toBe(true);
    // The import wrapper's scale was baked in during grouping, then the
    // new group's transform was baked in on ungroup.
    expect(parseTransform(rect.getAttribute("transform"))).toEqual([7.5, 0, 0, 7.5, 90, 100]);
    expect(parseTransform(plus.getAttribute("transform"))).toEqual([7.5, 0, 0, 7.5, 90, 100]);
    expect(stage.selectedIds).toHaveLength(2);
  });

  it("groups a top-level object with a shape nested inside a group", () => {
    const { stage, wrapper, path } = makeStage();
    stage.select(wrapper.id);
    stage.select(path.id, { additive: true });
    stage.groupSelection();

    const group = stage.docGroup.lastElementChild as SVGGElement;
    expect(group.children).toHaveLength(2);
    expect(group.contains(path)).toBe(true);
    expect(parseTransform(path.getAttribute("transform"))).toEqual([3.75, 0, 0, 3.75, 40, 40]);
    expect(stage.selectedIds).toEqual([group.id]);
  });

  it("undoes an ungroup in one step", () => {
    const { stage, rect, plus } = makeStage();
    stage.select(rect.id);
    stage.select(plus.id, { additive: true });
    stage.groupSelection();
    const groupId = stage.selectedIds[0]!;
    stage.select(groupId);
    stage.ungroupSelection();
    expect(stage.exportSvg()).not.toContain(`id="${groupId}"`);
    stage.undo();
    expect(stage.exportSvg()).toContain(`id="${groupId}"`);
  });
});

describe("detach", () => {
  it("pulls a nested object out with the parent transform baked in", () => {
    const { stage, wrapper, plus, path } = makeStage();
    stage.enterGroup(wrapper.id);
    stage.select(plus.id);
    stage.detachSelection();

    expect(stage.docGroup.contains(plus)).toBe(true);
    expect(wrapper.contains(plus)).toBe(false);
    expect(parseTransform(plus.getAttribute("transform"))).toEqual([3.75, 0, 0, 3.75, 40, 40]);
    // The inner path is untouched; its ancestor now carries the transform.
    expect(path.getAttribute("transform")).toBeNull();
    expect(stage.exportSvg()).toContain("<path");
  });
});

describe("align", () => {
  it("centers one object on another using document coordinates", () => {
    const { stage, rect, plus } = makeStage();
    (rect as SVGGraphicsElement).getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
    (plus as SVGGraphicsElement).getBBox = () =>
      ({ x: 20, y: 0, width: 10, height: 10 }) as DOMRect;
    stage.select(rect.id);
    stage.select(plus.id, { additive: true });

    stage.align("center");
    expect(parseTransform(plus.getAttribute("transform"))).toEqual([1, 0, 0, 1, -20, 0]);

    stage.align("top");
    expect(parseTransform(plus.getAttribute("transform"))).toEqual([1, 0, 0, 1, -20, 0]);
  });
});
