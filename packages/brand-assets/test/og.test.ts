import { join } from "node:path";
import { createElement, isValidElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { DefaultOgImage } from "../src/default-og";
import { loadOgComponent } from "../src/og";
import { hexToColor, svgToDataUrl } from "../src/utils";

describe("utils", () => {
  it("parses hex colors", () => {
    expect(hexToColor("#0f100f")).toEqual({ r: 15, g: 16, b: 15, alpha: 1 });
    expect(hexToColor("#fff")).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(() => hexToColor("nope")).toThrow(/Invalid hex color/);
  });

  it("turns an SVG file into an inline data URL", () => {
    const url = svgToDataUrl(join(import.meta.dirname, "fixtures", "icon.svg"));
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(url).toContain("%3Csvg");
  });
});

describe("components", () => {
  it("uses the built-in template", () => {
    expect(isValidElement(DefaultOgImage({ title: "Hello" }))).toBe(true);
  });

  it("ingests a TSX component by its default export", async () => {
    const Component = await loadOgComponent(join(import.meta.dirname, "fixtures", "OgImage.tsx"));
    expect(isValidElement(createElement(Component, { title: "Hello" }))).toBe(true);
  });

  it("ingests a TSX component by an explicit named export", async () => {
    const Component = await loadOgComponent(
      join(import.meta.dirname, "fixtures", "OgImage.tsx"),
      "OgImage",
    );
    expect(typeof Component).toBe("function");
  });
});
