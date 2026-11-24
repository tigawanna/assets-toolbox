import { afterEach, describe, expect, it } from "vite-plus/test";

import { Stage } from "../src/canvas/stage";
import { toHexColor } from "../src/doc/color";
import { TextTool } from "../src/tools/shapes";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" fill="#a5b4fc"/>
  <circle cx="32" cy="32" r="10" fill="rgb(239,68,68)"/>
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
  return stage;
};

describe("colors", () => {
  it("normalises SVG colors for the color input", () => {
    expect(toHexColor("#abc", "#ffffff")).toBe("#aabbcc");
    expect(toHexColor("rgb(239,68,68)", "#ffffff")).toBe("#ffffff");
    expect(toHexColor("none", "#a5b4fc")).toBe("#ffffff");
    expect(toHexColor(null, "#1f2937")).toBe("#1f2937");
  });

  it("applies fill and stroke to the whole selected group", () => {
    const stage = makeStage();
    stage.importSvg(SVG, "icon");
    const wrapper = stage.docGroup.firstElementChild as SVGGElement;
    stage.setStyle({ fill: "#10b981", stroke: "#1f2937", strokeWidth: 3 });

    for (const shape of wrapper.querySelectorAll("rect, circle")) {
      expect(shape.getAttribute("fill")).toBe("#10b981");
      expect(shape.getAttribute("stroke")).toBe("#1f2937");
      expect(shape.getAttribute("stroke-width")).toBe("3");
    }
    expect(stage.getSelectionStyle()).toMatchObject({
      fill: "#10b981",
      stroke: "#1f2937",
      strokeWidth: 3,
    });
    stage.undo();
    expect(stage.docGroup.querySelector("rect")?.getAttribute("fill")).toBe("#a5b4fc");
  });
});

describe("text", () => {
  it("places text on click and edits it through the inspector", () => {
    const stage = makeStage();
    stage.setTool(new TextTool());
    stage.svg.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 120,
        clientY: 80,
      }),
    );

    const text = stage.docGroup.querySelector("text")!;
    expect(text.textContent).toBe("Text");
    expect(text.getAttribute("font-size")).toBe("24");
    expect(stage.selectedIds).toEqual([text.id]);
    expect(stage.getSelectionStyle()).toMatchObject({ text: "Text", tag: "text" });

    stage.setStyle({ text: "Hello world", fontSize: 36, fill: "#ec4899" });
    expect(text.textContent).toBe("Hello world");
    expect(text.getAttribute("font-size")).toBe("36");
    expect(text.getAttribute("fill")).toBe("#ec4899");
    stage.undo();
    expect(stage.docGroup.querySelector("text")?.textContent).toBe("Text");
  });

  it("returns null text for shape selections", () => {
    const stage = makeStage();
    stage.importSvg(SVG, "icon");
    expect(stage.getSelectionStyle()?.text).toBeNull();
  });
});
