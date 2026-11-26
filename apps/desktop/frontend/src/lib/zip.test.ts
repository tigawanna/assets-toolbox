import { describe, expect, it } from "vite-plus/test";

import { uniqueZipNames, zipStore } from "./zip";

describe("zipStore", () => {
  it("writes a valid store-only archive", () => {
    const archive = zipStore([{ name: "sound.wav", data: new Uint8Array([1, 2, 3]) }]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(18, true)).toBe(3);
    expect(view.getUint32(22, true)).toBe(3);
    const nameLength = view.getUint16(26, true);
    expect(new TextDecoder().decode(archive.slice(30, 30 + nameLength))).toBe("sound.wav");
    expect(archive.at(-22)).toBe(0x50);
    expect(archive.at(-21)).toBe(0x4b);
    expect(archive.at(-20)).toBe(0x05);
    expect(archive.at(-19)).toBe(0x06);
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
