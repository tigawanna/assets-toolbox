import { describe, expect, it } from "vite-plus/test";

import {
  bandCovering,
  nextCoverage,
  normalizeBands,
  parseBandSelection,
  parseSliceSelection,
  duplicateSliceRange,
  patchBand,
  removeSliceRange,
  setBandSpan,
  spanLabel,
  type SliceBand,
} from "../src/lib/bands";

function band(id: string, start: number, count: number, color = "#111111"): SliceBand {
  return { id, start, count, color };
}

describe("slice bands", () => {
  it("grows a span to include a later slice", () => {
    expect(nextCoverage(0, 1, 1, 6)).toEqual({ start: 0, count: 2 });
    expect(nextCoverage(0, 2, 4, 6)).toEqual({ start: 0, count: 5 });
  });

  it("shrinks from either end or from the inside", () => {
    expect(nextCoverage(0, 3, 0, 6)).toEqual({ start: 1, count: 2 });
    expect(nextCoverage(0, 3, 2, 6)).toEqual({ start: 0, count: 2 });
    expect(nextCoverage(0, 4, 1, 6)).toEqual({ start: 0, count: 2 });
  });

  it("steals overlapping neighbors when a span grows", () => {
    const next = setBandSpan(
      [band("a", 0, 1), band("b", 1, 1, "#222222"), band("c", 2, 1, "#333333")],
      band("a", 0, 1),
      0,
      2,
      6,
    );
    expect(next.map((item) => ({ id: item.id, start: item.start, count: item.count }))).toEqual([
      { id: "a", start: 0, count: 2 },
      { id: "c", start: 2, count: 1 },
    ]);
  });

  it("splits a band when another span lands in the middle", () => {
    const next = setBandSpan([band("wide", 0, 6, "#abcdef")], band("new", 2, 1, "#ff0000"), 2, 2, 6);
    expect(next.map((item) => ({ id: item.id, start: item.start, count: item.count }))).toEqual([
      { id: "wide", start: 0, count: 2 },
      { id: "new", start: 2, count: 2 },
      { id: "wide-r", start: 4, count: 2 },
    ]);
  });

  it("drops bands that fall off the board when the slice count shrinks", () => {
    const next = normalizeBands([band("keep", 3, 2), band("gone", 5, 1)], 4);
    expect(next).toEqual([band("keep", 3, 1)]);
  });

  it("finds the band covering a slice", () => {
    const bands = [band("a", 0, 2), band("b", 2, 1)];
    expect(bandCovering(bands, 1)?.id).toBe("a");
    expect(bandCovering(bands, 2)?.id).toBe("b");
    expect(bandCovering(bands, 4)).toBeUndefined();
  });

  it("patches a band fill without dropping other bands", () => {
    const next = patchBand([band("a", 0, 1), band("b", 1, 1)], "a", {
      color: "#00ff00",
      imageId: "pic",
    });
    expect(next[0]).toMatchObject({ id: "a", color: "#00ff00", imageId: "pic" });
    expect(next[1]?.id).toBe("b");
  });

  it("shifts and trims bands when a slice is deleted", () => {
    const next = removeSliceRange(
      [band("left", 0, 1), band("gone", 1, 1, "#222222"), band("right", 2, 2, "#333333")],
      1,
      1,
      4,
    );
    expect(next.map((item) => ({ id: item.id, start: item.start, count: item.count }))).toEqual([
      { id: "left", start: 0, count: 1 },
      { id: "right", start: 1, count: 2 },
    ]);
  });

  it("keeps a spanning fill when a slice in the middle is removed", () => {
    const next = removeSliceRange([band("wide", 0, 5, "#abcdef")], 2, 1, 5);
    expect(next).toEqual([band("wide", 0, 4, "#abcdef")]);
  });

  it("copies a slice fill into the new columns and shifts later bands", () => {
    const next = duplicateSliceRange(
      [band("a", 0, 1, "#ff7700"), band("b", 1, 1, "#222222")],
      0,
      1,
      3,
    );
    expect(next.map((item) => ({ start: item.start, count: item.count, color: item.color }))).toEqual([
      { start: 0, count: 1, color: "#ff7700" },
      { start: 1, count: 1, color: "#ff7700" },
      { start: 2, count: 1, color: "#222222" },
    ]);
  });

  it("labels a span and parses selection ids", () => {
    expect(spanLabel(0, 1)).toBe("Slice 1");
    expect(spanLabel(0, 2)).toBe("Slices 1–2");
    expect(parseBandSelection("band:abc")).toBe("abc");
    expect(parseSliceSelection("slice:3")).toEqual({ collectionId: "", index: 3 });
    expect(parseSliceSelection("slice:col-main:3")).toEqual({
      collectionId: "col-main",
      index: 3,
    });
  });
});
