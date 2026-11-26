import { describe, expect, it } from "vite-plus/test";

import { normalizeHexColor } from "./ColorField";

describe("asset color fields", () => {
  it("normalizes shorthand and unprefixed hex colors", () => {
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("0f100f")).toBe("#0f100f");
    expect(normalizeHexColor(" #AABBCC ")).toBe("#aabbcc");
  });

  it("falls back for invalid colors", () => {
    expect(normalizeHexColor("not-a-color", "#123456")).toBe("#123456");
  });
});
