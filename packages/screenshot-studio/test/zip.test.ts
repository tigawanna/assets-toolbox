import { describe, expect, it } from "vite-plus/test";

import { zipStore } from "../src/lib/zip";

describe("zipStore", () => {
  it("packs named files into a zip with local headers", () => {
    const bytes = zipStore([
      { name: "hero/01.png", data: new Uint8Array([137, 80, 78, 71]) },
      { name: "hero/02.png", data: new Uint8Array([1, 2, 3]) },
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("hero/01.png");
    expect(text).toContain("hero/02.png");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});
