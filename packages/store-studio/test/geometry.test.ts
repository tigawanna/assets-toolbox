import { describe, expect, it } from "vite-plus/test";

import {
  bakeScale,
  clamp,
  cropPercentages,
  fitScreen,
  rotatedBounds,
  sliceForX,
  sliceRange,
  slicesIntersectingRect,
  snap,
} from "../src/model/geometry";

const trim = { top: 0, bottom: 0, left: 0, right: 0 };

describe("slices", () => {
  it("maps output pixels to slice windows", () => {
    expect(sliceRange(2, 1080, 1920)).toEqual({ x: 2160, y: 0, width: 1080, height: 1920 });
    expect(sliceForX(1081, 1080, 4)).toBe(1);
    expect(sliceForX(-10, 1080, 4)).toBe(0);
    expect(sliceForX(99999, 1080, 4)).toBe(3);
  });

  it("finds every slice a rotated rect crosses", () => {
    const rect = { x: 900, y: 100, width: 400, height: 800 };
    expect(slicesIntersectingRect(rect, 0, 1080, 4)).toEqual([0, 1]);
    expect(slicesIntersectingRect(rect, 12, 1080, 4)).toContain(1);
    expect(slicesIntersectingRect({ x: 5000, y: 0, width: 10, height: 10 }, 0, 1080, 4)).toEqual(
      [],
    );
  });

  it("computes rotated bounds", () => {
    const bounds = rotatedBounds({ x: 0, y: 0, width: 100, height: 50 }, 90);
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(100);
  });
});

describe("screen fitting", () => {
  it("covers and reports edge crops", () => {
    const fit = fitScreen(1000, 2000, trim, { x: 0, y: 0, width: 500, height: 1000 }, "cover", 1, {
      x: 0,
      y: 0,
    });
    expect(fit.target.width).toBeCloseTo(500);
    expect(fit.target.height).toBeCloseTo(1000);
    expect(cropPercentages(fit)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("crops a square capture inside a tall screen", () => {
    const fit = fitScreen(1000, 1000, trim, { x: 0, y: 0, width: 500, height: 1000 }, "cover", 1, {
      x: 0,
      y: 0,
    });
    expect(fit.target.height).toBeCloseTo(1000);
    expect(fit.target.width).toBeCloseTo(1000);
    const crop = cropPercentages(fit);
    expect(crop.left).toBeCloseTo(0.25);
    expect(crop.right).toBeCloseTo(0.25);
    expect(crop.top).toBe(0);
  });

  it("applies trim and contain, and scales with zoom", () => {
    const screen = { x: 0, y: 0, width: 500, height: 1000 };
    const fit = fitScreen(
      1000,
      2000,
      { top: 100, bottom: 100, left: 0, right: 0 },
      screen,
      "contain",
      1,
      { x: 0, y: 0 },
    );
    expect(fit.source).toEqual({ x: 0, y: 100, width: 1000, height: 1800 });
    expect(fit.target.width).toBeCloseTo(500);
    expect(fit.target.height).toBeCloseTo(900);
    const zoomed = fitScreen(
      1000,
      2000,
      { top: 100, bottom: 100, left: 0, right: 0 },
      screen,
      "contain",
      2,
      { x: 0, y: 0 },
    );
    expect(zoomed.target.width).toBeCloseTo(fit.target.width * 2);
  });
});

describe("transform helpers", () => {
  it("bakes scale into size without compounding", () => {
    const result = bakeScale({ x: 10, y: 20, width: 100, height: 200 }, 1.5, 0.5, 5, -5);
    expect(result).toEqual({ x: 15, y: 15, width: 150, height: 100 });
  });
  it("clamps and snaps", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(snap(9, [0, 10, 20], 2)).toBe(10);
    expect(snap(9, [0, 20], 2)).toBeNull();
  });
});
