import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(resolve(process.cwd(), "src/embedded.css"), "utf8");

describe("embedded SVG Compose styles", () => {
  it("scopes the editor skin to the package root", () => {
    expect(css.trimStart().startsWith("/*")).toBe(true);
    expect(css).toContain(".svg-compose-root");
    expect(css).not.toMatch(/^\s*(?:html|body|:root)\s*[,{]/m);
  });

  it("keeps the proven full-height, scrolling rail, and inspector layout", () => {
    expect(css).toContain("&.app");
    expect(css).toContain("height: 100%");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain(".panel.side.collapsed");
    expect(css).toContain(".inspector-field input");
  });
});
