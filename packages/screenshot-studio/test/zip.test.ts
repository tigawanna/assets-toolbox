import { describe, expect, it } from "vite-plus/test";

import { uniqueZipNames, zipStore } from "../src/lib/zip";

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

  it("keeps archive paths unique when names collide", () => {
    const files = uniqueZipNames([
      { name: "Untitled/01.png", data: "a" },
      { name: "Untitled/01.png", data: "b" },
      { name: "A B/01.png", data: "c" },
      { name: "A B/01.png", data: "d" },
      { name: "A B/01.png", data: "e" },
    ]);

    expect(files.map((file) => file.name)).toEqual([
      "Untitled/01.png",
      "Untitled/01-2.png",
      "A B/01.png",
      "A B/01-2.png",
      "A B/01-3.png",
    ]);
    expect(files.map((file) => file.data)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
