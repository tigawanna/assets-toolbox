import { describe, expect, it } from "vite-plus/test";

import { filterPackages, findPackage, toolPackages } from "./catalog";

describe("desktop catalog", () => {
  it("registers every tool with a stable TanStack route", () => {
    expect(toolPackages).toHaveLength(6);
    for (const tool of toolPackages) {
      expect(tool.route).toBe(`/packages/${tool.id}`);
      expect(findPackage(tool.id)).toBe(tool);
    }
  });

  it("filters by category and search text", () => {
    expect(filterPackages("vector", "All").map((tool) => tool.id)).toEqual(["svg-compose"]);
    expect(filterPackages("", "Prepare").map((tool) => tool.id)).toEqual([
      "brand-assets",
      "expo-assets",
    ]);
  });
});
