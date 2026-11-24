import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" fill="#e2e8f0"/>
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
  const rect = wrapper.querySelector("rect")!;
  const plus = wrapper.querySelector("g")!;
  const path = plus.querySelector("path")!;
  // jsdom has no geometry; a fixed bbox is enough to exercise overlay rendering.
  for (const element of [wrapper, rect, plus, path]) {
    (element as SVGGraphicsElement).getBBox = () =>
      ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  }
  // Re-select so the overlay is rendered with the stubbed geometry.
  stage.select(wrapper.id);
  return { stage, wrapper, rect, plus, path };
};

const pointer = (element: Element, init: MouseEventInit = {}) =>
  element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, ...init }));

const dblclick = (element: Element) =>
  element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

describe("selection", () => {
  it("click selects the top-level object in scope", () => {
    const { stage, wrapper, path } = makeStage();
    pointer(path);
    expect(stage.selectedIds).toEqual([wrapper.id]);
    stage.clearSelection();
    expect(stage.selectedIds).toEqual([]);
  });

  it("ctrl+click selects the concrete object inside a group", () => {
    const { stage, path } = makeStage();
    pointer(path, { ctrlKey: true });
    expect(stage.selectedIds).toEqual([path.id]);
  });

  it("shift+click adds and removes from the selection", () => {
    const { stage, wrapper, rect } = makeStage();
    stage.clearSelection();
    pointer(wrapper);
    pointer(rect, { ctrlKey: true, shiftKey: true });
    expect(new Set(stage.selectedIds)).toEqual(new Set([wrapper.id, rect.id]));
    pointer(rect, { ctrlKey: true, shiftKey: true });
    stage.svg.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    expect(stage.selectedIds).toEqual([wrapper.id]);
  });

  it("alt+click can pick the object underneath", () => {
    const { stage, wrapper, path } = makeStage();
    // Start with an inner object selected; the next usable hit in scope is the
    // top-level wrapper underneath it.
    pointer(path, { ctrlKey: true });
    const original = document.elementsFromPoint.bind(document);
    document.elementsFromPoint = () => [path, wrapper];
    try {
      pointer(path, { altKey: true, clientX: 10, clientY: 10 });
      expect(stage.selectedIds).toEqual([wrapper.id]);
    } finally {
      document.elementsFromPoint = original;
    }
  });

  it("double-click enters a group and exit returns to its parent", () => {
    const { stage, wrapper, plus, path } = makeStage();
    dblclick(path);
    expect(stage.enteredGroupId).toBe(wrapper.id);
    expect(stage.selectedIds).toHaveLength(1);
    // Clicks now resolve to the top-level object inside the entered group.
    pointer(path);
    expect(stage.selectedIds).toEqual([plus.id]);
    // Double-clicking that nested group enters it one level deeper.
    dblclick(plus);
    expect(stage.enteredGroupId).toBe(plus.id);
    expect(stage.selectedIds).toEqual([path.id]);
    stage.exitGroup();
    expect(stage.enteredGroupId).toBe(wrapper.id);
    expect(stage.selectedIds).toEqual([plus.id]);
    stage.exitGroup();
    expect(stage.enteredGroupId).toBeNull();
    expect(stage.selectedIds).toEqual([wrapper.id]);
  });

  it("renders overlay boxes outside the document group", () => {
    const { stage, wrapper } = makeStage();
    expect(stage.overlay.querySelectorAll(".overlay-selection")).toHaveLength(1);
    expect(stage.overlay.querySelectorAll(".overlay-handle")).toHaveLength(4);
    expect(stage.exportSvg()).not.toContain("overlay-selection");
    stage.clearSelection();
    expect(stage.overlay.children).toHaveLength(0);
    expect(wrapper).toBeTruthy();
  });
});

describe("layer operations", () => {
  it("deletes and duplicates a layer by id from the tree", () => {
    const { stage, wrapper, path } = makeStage();
    stage.deleteById(path.id);
    expect(stage.docGroup.querySelector("path")).toBeNull();
    expect(stage.getTree()[0]!.children[1].children).toHaveLength(0);
    stage.undo();
    expect(stage.docGroup.querySelector("path")).toBeTruthy();

    stage.select(path.id);
    stage.duplicateById(path.id);
    expect(stage.docGroup.querySelectorAll("path")).toHaveLength(2);
    expect(stage.selectedIds[0]).not.toBe(path.id);
    expect(wrapper).toBeTruthy();
  });

  it("getTree mirrors the DOM including nested groups", () => {
    const { stage, wrapper, plus } = makeStage();
    const tree = stage.getTree();
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: wrapper.id, tag: "g", label: "box-plus-circle" });
    expect(tree[0]!.children[1]).toMatchObject({ id: plus.id, tag: "g", label: "Group" });
  });

  it("deletes the selection and restores it with undo", () => {
    const { stage, wrapper } = makeStage();
    stage.deleteSelection();
    expect(stage.docGroup.children).toHaveLength(0);
    expect(stage.exportSvg()).not.toContain("<rect");
    stage.undo();
    expect(stage.docGroup.firstElementChild?.id).toBe(wrapper.id);
  });

  it("toggles visibility and records it in the tree", () => {
    const { stage, wrapper } = makeStage();
    stage.toggleVisibility(wrapper.id);
    expect(stage.getTree()[0]!.hidden).toBe(true);
    expect(stage.selectedIds).toEqual([]);
    stage.toggleVisibility(wrapper.id);
    expect(stage.getTree()[0]!.hidden).toBe(false);
  });

  it("reorders siblings", () => {
    const { stage, wrapper, rect, plus } = makeStage();
    stage.select(rect.id);
    stage.reorder("front");
    expect(Array.from(wrapper.children).at(-1)).toBe(rect);
    stage.reorder("back");
    expect(wrapper.firstElementChild).toBe(rect);
    expect(plus).toBeTruthy();
  });

  it("duplicates objects with fresh ids", () => {
    const { stage, wrapper, path } = makeStage();
    stage.select(path.id);
    stage.duplicateSelection();
    const paths = wrapper.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[1]!.id).not.toBe(path.id);
    expect(stage.selectedIds).toEqual([paths[1]!.id]);
  });

  it("Delete and Escape keys act on the selection", () => {
    const { stage, wrapper } = makeStage();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(stage.selectedIds).toEqual([]);
    stage.select(wrapper.id);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(stage.docGroup.children).toHaveLength(0);
  });
});
