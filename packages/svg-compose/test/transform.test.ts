import { describe, expect, it } from "vite-plus/test";

import {
  IDENTITY,
  bakeInto,
  multiply,
  parseTransform,
  rotate,
  stringifyTransform,
  translate,
} from "../src/doc/transform";

const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 5);

describe("transform matrices", () => {
  it("parses the import wrapper transform", () => {
    const matrix = parseTransform("translate(40 40) scale(3.75) translate(0 0)");
    expect(matrix).toEqual([3.75, 0, 0, 3.75, 40, 40]);
  });

  it("parses matrix, rotate, skew and mixed lists", () => {
    expect(parseTransform("matrix(1 2 3 4 5 6)")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parseTransform("rotate(90)")).toEqual([0, 1, -1, 0, 0, 0]);
    close(parseTransform("skewX(45)")[2]!, 1);
    const mixed = parseTransform("translate(10 20) rotate(90) scale(2 3)");
    close(mixed[0], 0);
    close(mixed[1], 2);
    close(mixed[2], -3);
    close(mixed[3], 0);
    close(mixed[4], 10);
    close(mixed[5], 20);
  });

  it("composes translations and rotation around a centre", () => {
    const matrix = parseTransform("rotate(90 10 10)");
    close(matrix[4], 20);
    close(matrix[5], 0);
    const combined = multiply(translate(5, 6), rotate(90));
    close(combined[4], 5);
    close(combined[5], 6);
  });

  it("stringifies and bakes transforms", () => {
    expect(stringifyTransform(IDENTITY)).toBeNull();
    expect(stringifyTransform(translate(2, 3))).toBe("matrix(1 0 0 1 2 3)");
    const element = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bakeInto(element, parseTransform("translate(10 20) scale(2)"));
    expect(element.getAttribute("transform")).toBe("matrix(2 0 0 2 10 20)");
    bakeInto(element, parseTransform("translate(-5 -10)"));
    expect(parseTransform(element.getAttribute("transform"))).toEqual([2, 0, 0, 2, 5, 10]);
  });
});
