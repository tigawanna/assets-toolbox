/**
 * Import: parse untrusted SVG text, sanitize it, give every element a stable
 * id, and normalize it into the live document group.
 */
import DOMPurify from "dompurify";

import { assignIds, nextId } from "./ids";

export const SVG_NS = "http://www.w3.org/2000/svg";

export type ImportBox = { x: number; y: number; width: number; height: number };

export type ParsedSvg = {
  root: SVGSVGElement;
  box: ImportBox;
};

const sanitize = (text: string) =>
  DOMPurify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "style"],
    FORBID_ATTR: ["onload", "onclick", "onerror"],
  });

export function parseSvg(text: string): ParsedSvg {
  const clean = sanitize(text);
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a valid SVG file");
  const root = doc.documentElement as unknown as SVGSVGElement;
  if (root.nodeName.toLowerCase() !== "svg") throw new Error("Not an SVG file");

  const box = readViewBox(root);
  assignIds(root);
  return { root, box };
}

function readViewBox(root: SVGSVGElement): ImportBox {
  const raw = (root.getAttribute("viewBox") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (raw.length === 4 && raw.every(Number.isFinite)) {
    return { x: raw[0]!, y: raw[1]!, width: raw[2]!, height: raw[3]! };
  }
  const width = Number.parseFloat(root.getAttribute("width") ?? "") || 100;
  const height = Number.parseFloat(root.getAttribute("height") ?? "") || 100;
  return { x: 0, y: 0, width, height };
}

/**
 * Move a parsed SVG's children into the document, wrapped in a group that
 * scales the source viewBox into place. Source coordinates are preserved
 * inside the group, so the import can be moved/scaled as a unit or ungrouped
 * later without touching the inner shapes.
 */
export function importIntoDocument(
  parsed: ParsedSvg,
  name: string,
  docGroup: SVGGElement,
  options: { targetSize?: number; placeAt?: { x: number; y: number } } = {},
): SVGGElement {
  const { targetSize = 240, placeAt } = options;
  const group = docGroup.ownerDocument.createElementNS(SVG_NS, "g");
  group.setAttribute("data-name", name);
  group.id = `import-${nextId()}`;

  while (parsed.root.firstChild) group.appendChild(parsed.root.firstChild);

  const { box } = parsed;
  const scale = targetSize / Math.max(box.width, box.height, 1);
  const x = placeAt?.x ?? 40;
  const y = placeAt?.y ?? 40;
  group.setAttribute(
    "transform",
    `translate(${round(x)} ${round(y)}) scale(${round(scale)}) translate(${-box.x} ${-box.y})`,
  );

  docGroup.appendChild(group);
  return group;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
