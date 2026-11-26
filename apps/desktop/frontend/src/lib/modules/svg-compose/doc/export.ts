/** Export: serialize the live document group into a standalone SVG file. */

export type Box = { x: number; y: number; width: number; height: number };

const expand = (box: Box, padding: number): Box => ({
  x: box.x - padding,
  y: box.y - padding,
  width: box.width + padding * 2,
  height: box.height + padding * 2,
});

const round = (value: number) => Math.round(value * 1000) / 1000;

/** getBBox is unavailable in some test DOMs — fall back to the viewBox. */
export function safeBBox(element: Element, fallback: Box): Box {
  try {
    const box = (element as SVGGraphicsElement).getBBox?.();
    if (
      box &&
      Number.isFinite(box.width) &&
      Number.isFinite(box.height) &&
      (box.width || box.height)
    ) {
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }
  } catch {
    // fall through
  }
  return fallback;
}

export function documentBox(docGroup: SVGGElement, fallback?: Box): Box {
  const declared = docGroup.ownerSVGElement?.getAttribute("viewBox");
  const parsed = declared
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const base: Box =
    fallback ??
    (parsed && parsed.length === 4 && parsed.every(Number.isFinite)
      ? { x: parsed[0]!, y: parsed[1]!, width: parsed[2]!, height: parsed[3]! }
      : { x: 0, y: 0, width: 100, height: 100 });
  return safeBBox(docGroup, base);
}

/** Serialize `docGroup`'s children into a standalone, self-contained SVG. */
export function serializeDocument(
  docGroup: SVGGElement,
  options: { padding?: number; box?: Box } = {},
): string {
  const padding = options.padding ?? 8;
  const box = expand(options.box ?? documentBox(docGroup), padding);
  const children = docGroup.innerHTML;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${round(box.width)}" height="${round(box.height)}" ` +
    `viewBox="${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(
      box.height,
    )}">${children}</svg>`
  );
}

export const downloadText = (filename: string, text: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
