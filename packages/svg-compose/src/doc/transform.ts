/**
 * Small affine transform helpers. SVG transform lists are kept as 2×3 matrices
 * so a parent's transform can be baked into its children on ungroup/detach.
 * Matrix layout matches `matrix(a b c d e f)`: x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    round(a[0] * b[0] + a[2] * b[1]),
    round(a[1] * b[0] + a[3] * b[1]),
    round(a[0] * b[2] + a[2] * b[3]),
    round(a[1] * b[2] + a[3] * b[3]),
    round(a[0] * b[4] + a[2] * b[5] + a[4]),
    round(a[1] * b[4] + a[3] * b[5] + a[5]),
  ];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scale = (x: number, y = x): Matrix => [x, 0, 0, y, 0, 0];

export function rotate(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}

export const skewX = (degrees: number): Matrix => [
  1,
  0,
  Math.tan((degrees * Math.PI) / 180),
  1,
  0,
  0,
];

export const skewY = (degrees: number): Matrix => [
  1,
  Math.tan((degrees * Math.PI) / 180),
  0,
  1,
  0,
  0,
];

const TOKEN = /[a-zA-Z]+|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const isNumberToken = (token: string | undefined) => Boolean(token && /^[-+.\d]/.test(token));

/** Parse an SVG `transform` attribute (matrix, translate, scale, rotate, skew). */
export function parseTransform(value: string | null | undefined): Matrix {
  if (!value) return IDENTITY;
  const tokens = value.match(TOKEN) ?? [];
  let result = IDENTITY;
  let index = 0;
  const number = () => Number(tokens[index++] ?? 0);

  while (index < tokens.length) {
    const operation = tokens[index++]?.toLowerCase();
    if (operation === "matrix" && index + 6 <= tokens.length) {
      result = multiply(result, [number(), number(), number(), number(), number(), number()]);
    } else if (operation === "translate") {
      const x = number();
      const y = isNumberToken(tokens[index]) ? number() : 0;
      result = multiply(result, translate(x, y));
    } else if (operation === "scale") {
      const x = number();
      const y = isNumberToken(tokens[index]) ? number() : x;
      result = multiply(result, scale(x, y));
    } else if (operation === "rotate") {
      const degrees = number();
      let rotation = rotate(degrees);
      if (isNumberToken(tokens[index])) {
        const cx = number();
        const cy = number();
        rotation = multiply(multiply(translate(cx, cy), rotation), translate(-cx, -cy));
      }
      result = multiply(result, rotation);
    } else if (operation === "skewx") {
      result = multiply(result, skewX(number()));
    } else if (operation === "skewy") {
      result = multiply(result, skewY(number()));
    }
  }
  return result;
}

export function stringifyTransform(matrix: Matrix): string | null {
  if (matrix.every((value, index) => value === IDENTITY[index])) return null;
  return `matrix(${matrix.map(round).join(" ")})`;
}

export function setTransform(element: Element, matrix: Matrix): void {
  const value = stringifyTransform(matrix);
  if (value) element.setAttribute("transform", value);
  else element.removeAttribute("transform");
}

/** Compose a parent matrix into an element's own transform. */
export const bakeInto = (element: Element, parentMatrix: Matrix): void =>
  setTransform(element, multiply(parentMatrix, parseTransform(element.getAttribute("transform"))));

/** Transform a point by a 2×3 matrix. */
export const applyMatrix = (matrix: Matrix, x: number, y: number): StageLikePoint => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
});

type StageLikePoint = { x: number; y: number };

/** Inverse of a 2×3 affine matrix (identity when singular). */
export function invertMatrix(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (!determinant) return IDENTITY;
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

export const isIdentity = (matrix: Matrix): boolean =>
  matrix.every((value, index) => value === IDENTITY[index]);
