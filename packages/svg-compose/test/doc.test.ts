import { describe, expect, it } from "vite-plus/test";

import { serializeDocument, safeBBox, documentBox } from "../src/doc/export";
import { importIntoDocument, parseSvg } from "../src/doc/import";

const BOX_PLUS_CIRCLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="6" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>
  <g id="plus">
    <path d="M32 16 V48 M16 32 H48" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`;

const newDoc = (viewBox = "0 0 64 64") => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = "doc";
  svg.append(group);
  return { svg, group };
};

describe("parseSvg (sanitize)", () => {
  it("strips scripts, event handlers and javascript: links", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
      <script>alert(1)</script>
      <rect width="10" height="10" onclick="alert(2)" onload="alert(3)"/>
      <a href="javascript:alert(4)"><circle r="1"/></a>
      <foreignObject><div>x</div></foreignObject>
    </svg>`;
    const { root } = parseSvg(dirty);
    const serialized = new XMLSerializer().serializeToString(root);
    expect(serialized).not.toContain("<script");
    expect(serialized).not.toContain("foreignObject");
    expect(serialized).not.toContain("onclick");
    expect(serialized).not.toContain("onload");
    expect(serialized).not.toContain("javascript:");
    // The innocent geometry survives.
    expect(root.querySelector("rect")).toBeTruthy();
    expect(root.querySelector("circle")).toBeTruthy();
  });

  it("keeps SVG structure and reads the viewBox", () => {
    const { root, box } = parseSvg(BOX_PLUS_CIRCLE);
    expect(box).toEqual({ x: 0, y: 0, width: 64, height: 64 });
    expect(root.querySelector("rect")).toBeTruthy();
    expect(root.querySelector("#plus path")).toBeTruthy();
  });

  it("rejects non-SVG and malformed input", () => {
    expect(() => parseSvg("<html><body>hi</body></html>")).toThrow();
    expect(() => parseSvg("not markup at all")).toThrow();
  });

  it("falls back to width/height when there is no viewBox", () => {
    const { box } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"/>`);
    expect(box).toEqual({ x: 0, y: 0, width: 80, height: 40 });
  });
});

describe("assignIds", () => {
  it("gives every element a stable, unique id", () => {
    const { root } = parseSvg(BOX_PLUS_CIRCLE);
    const elements = Array.from(root.querySelectorAll("*"));
    const ids = elements.map((element) => element.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps existing unique ids", () => {
    const { root } = parseSvg(BOX_PLUS_CIRCLE);
    expect(root.querySelector("#plus")).toBeTruthy();
  });

  it("replaces duplicate ids", () => {
    const { root } = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4">
         <rect id="dup" width="1" height="1"/><circle id="dup" r="1"/>
       </svg>`,
    );
    const ids = Array.from(root.querySelectorAll("[id]")).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("import → export round trip", () => {
  it("preserves rect + circle structure through the document", () => {
    const { group } = newDoc();
    importIntoDocument(parseSvg(BOX_PLUS_CIRCLE), "box-plus", group, {
      targetSize: 64,
      placeAt: { x: 0, y: 0 },
    });

    expect(group.children).toHaveLength(1);
    const wrapper = group.firstElementChild as SVGGElement;
    expect(wrapper.getAttribute("data-name")).toBe("box-plus");
    expect(wrapper.querySelector("rect")).toBeTruthy();
    expect(wrapper.querySelector("path")).toBeTruthy();

    const out = serializeDocument(group, {
      box: { x: 0, y: 0, width: 64, height: 64 },
      padding: 0,
    });
    expect(out).toContain("<rect");
    expect(out).toContain("<path");
    expect(out).toContain('viewBox="0 0 64 64"');
    expect(out).not.toContain("overlay");
    expect(out).not.toContain("<script");
  });

  it("exports can be re-imported without loss", () => {
    const first = newDoc();
    importIntoDocument(parseSvg(BOX_PLUS_CIRCLE), "box-plus", first.group, {
      targetSize: 64,
      placeAt: { x: 0, y: 0 },
    });
    const exported = serializeDocument(first.group, {
      box: { x: 0, y: 0, width: 64, height: 64 },
      padding: 0,
    });

    const second = newDoc();
    importIntoDocument(parseSvg(exported), "again", second.group, {
      targetSize: 64,
      placeAt: { x: 0, y: 0 },
    });
    expect(second.group.querySelectorAll("rect")).toHaveLength(1);
    expect(second.group.querySelectorAll("path")).toHaveLength(1);
  });

  it("places imports inside the document group with a transform", () => {
    const { group } = newDoc();
    const wrapper = importIntoDocument(parseSvg(BOX_PLUS_CIRCLE), "box", group, {
      targetSize: 128,
      placeAt: { x: 10, y: 20 },
    });
    expect(wrapper.getAttribute("transform")).toBe("translate(10 20) scale(2) translate(0 0)");
  });
});

describe("export helpers", () => {
  it("safeBBox falls back when getBBox is unavailable or empty", () => {
    const { group } = newDoc();
    const fallback = { x: 1, y: 2, width: 3, height: 4 };
    expect(safeBBox(group, fallback)).toEqual(fallback);
    expect(documentBox(group, fallback)).toEqual(fallback);
  });

  it("expands the box by padding", () => {
    const { group } = newDoc();
    const out = serializeDocument(group, {
      box: { x: 10, y: 10, width: 20, height: 20 },
      padding: 5,
    });
    expect(out).toContain('viewBox="5 5 30 30"');
    expect(out).toContain('width="30"');
  });
});
