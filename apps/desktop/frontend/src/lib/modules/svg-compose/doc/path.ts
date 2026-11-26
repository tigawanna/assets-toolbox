/**
 * Shape -> path conversion and a small M/L/C/Z path model for node editing.
 * The 0.5522847498 constant is the cubic circle approximation factor used by
 * Inkscape when a square's corners are made smooth.
 */
export const KAPPA = 0.5522847498;

const value = (element: Element, name: string, fallback = 0) =>
  Number.parseFloat(element.getAttribute(name) ?? "") || fallback;
const round = (n: number) => Math.round(n * 1000) / 1000;
const xy = (x: number, y: number) => `${round(x)} ${round(y)}`;

export type PathNode = {
  x: number;
  y: number;
  in: { x: number; y: number } | null;
  out: { x: number; y: number } | null;
};

export type PathModel = { nodes: PathNode[]; closed: boolean };

const node = (x: number, y: number): PathNode => ({ x, y, in: null, out: null });

/** Convert a basic shape into equivalent path data (keeps source geometry). */
export function shapeToPathData(element: Element): string | null {
  const tag = element.tagName.toLowerCase();
  const attr = (name: string) => element.getAttribute(name);

  if (tag === "path") return attr("d");
  if (tag === "rect") {
    const x = value(element, "x");
    const y = value(element, "y");
    const width = value(element, "width");
    const height = value(element, "height");
    const rx = Math.min(value(element, "rx", value(element, "ry")), width / 2);
    const ry = Math.min(value(element, "ry", value(element, "rx")), height / 2);
    if (!rx || !ry) {
      return `M ${xy(x, y)} L ${xy(x + width, y)} L ${xy(x + width, y + height)} L ${xy(
        x,
        y + height,
      )} Z`;
    }
    const ox = KAPPA * rx;
    const oy = KAPPA * ry;
    return [
      `M ${xy(x + rx, y)}`,
      `L ${xy(x + width - rx, y)}`,
      `C ${xy(x + width - rx + ox, y)} ${xy(x + width, y + ry - oy)} ${xy(x + width, y + ry)}`,
      `L ${xy(x + width, y + height - ry)}`,
      `C ${xy(x + width, y + height - ry + oy)} ${xy(x + width - rx + ox, y + height)} ${xy(x + width - rx, y + height)}`,
      `L ${xy(x + rx, y + height)}`,
      `C ${xy(x + rx - ox, y + height)} ${xy(x, y + height - ry + oy)} ${xy(x, y + height - ry)}`,
      `L ${xy(x, y + ry)}`,
      `C ${xy(x, y + ry - oy)} ${xy(x + rx - ox, y)} ${xy(x + rx, y)}`,
      "Z",
    ].join(" ");
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = tag === "circle" ? value(element, "cx") : value(element, "cx");
    const cy = tag === "circle" ? value(element, "cy") : value(element, "cy");
    const rx = tag === "circle" ? value(element, "r") : value(element, "rx");
    const ry = tag === "circle" ? value(element, "r") : value(element, "ry");
    if (!rx || !ry) return null;
    const ox = KAPPA * rx;
    const oy = KAPPA * ry;
    return [
      `M ${xy(cx, cy - ry)}`,
      `C ${xy(cx + ox, cy - ry)} ${xy(cx + rx, cy - oy)} ${xy(cx + rx, cy)}`,
      `C ${xy(cx + rx, cy + oy)} ${xy(cx + ox, cy + ry)} ${xy(cx, cy + ry)}`,
      `C ${xy(cx - ox, cy + ry)} ${xy(cx - rx, cy + oy)} ${xy(cx - rx, cy)}`,
      `C ${xy(cx - rx, cy - oy)} ${xy(cx - ox, cy - ry)} ${xy(cx, cy - ry)}`,
      "Z",
    ].join(" ");
  }
  if (tag === "line") {
    return `M ${xy(value(element, "x1"), value(element, "y1"))} L ${xy(
      value(element, "x2"),
      value(element, "y2"),
    )}`;
  }
  if (tag === "polygon" || tag === "polyline") {
    const points = (attr("points") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (points.length < 4) return null;
    const pairs: string[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) pairs.push(xy(points[i]!, points[i + 1]!));
    return `M ${pairs.join(" L ")}${tag === "polygon" ? " Z" : ""}`;
  }
  return null;
}

const TOKEN = /[MLCZmlcz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** Parse the subset of path data produced by this editor (M, L, C, Z). */
export function pathToModel(data: string | null): PathModel | null {
  if (!data) return null;
  const tokens = data.match(TOKEN) ?? [];
  const nodes: PathNode[] = [];
  let closed = false;
  let index = 0;
  const number = () => Number(tokens[index++] ?? 0);
  let current = { x: 0, y: 0 };

  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === "M") {
      if (nodes.length) return null; // multiple subpaths are not node-editable
      current = { x: number(), y: number() };
      nodes.push(node(current.x, current.y));
    } else if (command === "L") {
      current = { x: number(), y: number() };
      nodes.push(node(current.x, current.y));
    } else if (command === "C") {
      const c1 = { x: number(), y: number() };
      const c2 = { x: number(), y: number() };
      const end = { x: number(), y: number() };
      const start = nodes.at(-1);
      if (!start) return null;
      start.out = { x: c1.x - start.x, y: c1.y - start.y };
      const next = node(end.x, end.y);
      next.in = { x: c2.x - end.x, y: c2.y - end.y };
      nodes.push(next);
      current = end;
    } else if (command === "Z") {
      closed = true;
    } else {
      return null;
    }
  }
  if (nodes.length < 2) return null;
  return { nodes, closed };
}

export function modelToPath(model: PathModel): string {
  const parts = [`M ${xy(model.nodes[0]!.x, model.nodes[0]!.y)}`];
  for (let i = 1; i < model.nodes.length; i += 1) {
    const from = model.nodes[i - 1]!;
    const to = model.nodes[i]!;
    if (from.out || to.in) {
      parts.push(
        `C ${xy(from.x + (from.out?.x ?? 0), from.y + (from.out?.y ?? 0))} ${xy(
          to.x + (to.in?.x ?? 0),
          to.y + (to.in?.y ?? 0),
        )} ${xy(to.x, to.y)}`,
      );
    } else {
      parts.push(`L ${xy(to.x, to.y)}`);
    }
  }
  if (model.closed) {
    const last = model.nodes.at(-1)!;
    const first = model.nodes[0]!;
    if (last.out || first.in) {
      parts.push(
        `C ${xy(last.x + (last.out?.x ?? 0), last.y + (last.out?.y ?? 0))} ${xy(
          first.x + (first.in?.x ?? 0),
          first.y + (first.in?.y ?? 0),
        )} ${xy(first.x, first.y)}`,
      );
    }
    parts.push("Z");
  }
  return parts.join(" ");
}

/** Make a node smooth: handles point along its neighbors, length kappa·distance. */
export function makeSmooth(model: PathModel, index: number): void {
  const current = model.nodes[index];
  if (!current) return;
  const previous = model.nodes[index - 1] ?? (model.closed ? model.nodes.at(-1) : null);
  const next = model.nodes[index + 1] ?? (model.closed ? model.nodes[0] : null);
  if (!previous || !next) return;
  const tangent = (from: PathNode, to: PathNode) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    // Half the neighbour distance is the radius for a square's side, so the
    // standard 0.5523 factor turns a converted rectangle into an ellipse.
    const handle = (KAPPA * length) / 2;
    return { x: (dx / length) * handle, y: (dy / length) * handle };
  };
  current.in = tangent(current, previous);
  current.out = tangent(current, next);
}

export const makeCorner = (model: PathModel, index: number) => {
  const current = model.nodes[index];
  if (current) current.in = null;
  if (current) current.out = null;
};
