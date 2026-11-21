/** Pure geometry: slices, transforms, screen fitting and crop math. Unit-tested. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ScreenRect extends Rect {
  radius: number;
}

export function sliceRange(index: number, sliceWidth: number, height: number): Rect {
  return { x: index * sliceWidth, y: 0, width: sliceWidth, height };
}

export function sliceForX(x: number, sliceWidth: number, sliceCount: number): number {
  return Math.max(0, Math.min(sliceCount - 1, Math.floor(x / sliceWidth)));
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Bounding box of a rotated rectangle around its top-left corner. */
export function rotatedBounds(rect: Rect, rotationDeg: number): Rect {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

export function rotatedCorners(rect: Rect, rotationDeg: number): Point[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    { x: -rect.width / 2, y: -rect.height / 2 },
    { x: rect.width / 2, y: -rect.height / 2 },
    { x: rect.width / 2, y: rect.height / 2 },
    { x: -rect.width / 2, y: rect.height / 2 },
  ].map((point) => ({
    x: cx + point.x * cos - point.y * sin,
    y: cy + point.x * sin + point.y * cos,
  }));
}

/** Which slice windows a node touches (uses the rotated bounding box). */
export function slicesIntersectingRect(
  rect: Rect,
  rotationDeg: number,
  sliceWidth: number,
  sliceCount: number,
): number[] {
  const bounds = rotatedBounds(rect, rotationDeg);
  const first = Math.max(0, Math.floor(bounds.x / sliceWidth));
  const last = Math.min(sliceCount - 1, Math.floor((bounds.x + bounds.width) / sliceWidth));
  const result: number[] = [];
  for (let index = first; index <= last; index += 1) result.push(index);
  return result;
}

/** Scale a device-local screen rect by the node's width/height scale. */
export function scaleScreenRect(
  screen: ScreenRect,
  nodeWidth: number,
  nodeHeight: number,
  unitW: number,
  unitH: number,
): ScreenRect {
  const sx = nodeWidth / unitW;
  const sy = nodeHeight / unitH;
  return {
    x: screen.x * sx,
    y: screen.y * sy,
    width: screen.width * sx,
    height: screen.height * sy,
    radius: screen.radius * Math.min(sx, sy),
  };
}

export interface Trim {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ScreenFit {
  /** Source rectangle actually shown, in trimmed source pixels. */
  source: Rect;
  /** Destination rectangle inside the screen, in node-local pixels. */
  target: Rect;
  /** The screen rectangle the capture is clipped to. */
  screen: Rect;
  fit: "cover" | "contain" | "fill";
}

/**
 * Fit a (trimmed) capture inside a screen. `cover` fills and crops, `contain`
 * letterboxes, `fill` stretches. `zoom` and `offset` are applied after fitting.
 */
export function fitScreen(
  sourceWidth: number,
  sourceHeight: number,
  trim: Trim,
  screen: Rect,
  fit: "cover" | "contain" | "fill",
  zoom: number,
  offset: { x: number; y: number },
): ScreenFit {
  const srcW = Math.max(1, sourceWidth - trim.left - trim.right);
  const srcH = Math.max(1, sourceHeight - trim.top - trim.bottom);
  const scaleX = screen.width / srcW;
  const scaleY = screen.height / srcH;
  const scale =
    fit === "fill"
      ? 1
      : (fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)) * zoom;

  const width = fit === "fill" ? screen.width : srcW * scale;
  const height = fit === "fill" ? screen.height : srcH * scale;
  const maxOffsetX = Math.max(0, (width - screen.width) / 2);
  const maxOffsetY = Math.max(0, (height - screen.height) / 2);
  const x = screen.x + screen.width / 2 - width / 2 + offset.x * maxOffsetX;
  const y = screen.y + screen.height / 2 - height / 2 + offset.y * maxOffsetY;

  return {
    source: { x: trim.left, y: trim.top, width: srcW, height: srcH },
    target: { x, y, width, height },
    screen,
    fit,
  };
}

/** Percentage of the source hidden on each edge by a cover fit. */
export function cropPercentages(fit: ScreenFit): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const { source, target, screen } = fit;
  if (fit.fit === "contain" || fit.fit === "fill" || target.width <= 0 || target.height <= 0) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const scaleX = target.width / source.width;
  const scaleY = target.height / source.height;
  const hiddenX = Math.max(0, (target.width - screen.width) / scaleX);
  const hiddenY = Math.max(0, (target.height - screen.height) / scaleY);
  const left = hiddenX / 2 / source.width;
  const top = hiddenY / 2 / source.height;
  return { top, bottom: top, left, right: left };
}

/** Bake a Konva transform into plain document data (size, never scale). */
export function bakeScale<T extends { width: number; height: number; x: number; y: number }>(
  node: T,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): T {
  const width = node.width * scaleX;
  const height = node.height * scaleY;
  return {
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snap(value: number, targets: number[], threshold = 8): number | null {
  let best: number | null = null;
  let distance = threshold;
  for (const target of targets) {
    const delta = Math.abs(value - target);
    if (delta <= distance) {
      distance = delta;
      best = target;
    }
  }
  return best;
}
