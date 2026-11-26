export interface SliceBand {
  id: string;
  start: number;
  count: number;
  color: string;
  imageId?: string;
}

export const BAND_PREFIX = "band:";
export const SLICE_PREFIX = "slice:";

export function bandSelectionId(id: string): string {
  return `${BAND_PREFIX}${id}`;
}

export function sliceSelectionId(collectionId: string, index: number): string {
  return `${SLICE_PREFIX}${collectionId}:${index}`;
}

export function parseBandSelection(id: string | null): string | null {
  if (id === null || !id.startsWith(BAND_PREFIX)) return null;
  const value = id.slice(BAND_PREFIX.length);
  return value === "" ? null : value;
}

export function parseSliceSelection(
  id: string | null,
): { collectionId: string; index: number } | null {
  if (id === null || !id.startsWith(SLICE_PREFIX)) return null;
  const rest = id.slice(SLICE_PREFIX.length);
  const sep = rest.lastIndexOf(":");
  if (sep === -1) {
    const index = Number(rest);
    return Number.isInteger(index) && index >= 0 ? { collectionId: "", index } : null;
  }
  const collectionId = rest.slice(0, sep);
  const index = Number(rest.slice(sep + 1));
  return Number.isInteger(index) && index >= 0 ? { collectionId, index } : null;
}

export function createSliceBand(
  start: number,
  count: number,
  color: string,
  imageId?: string,
): SliceBand {
  return {
    id: `band-${crypto.randomUUID().slice(0, 8)}`,
    start,
    count,
    color,
    ...(imageId === undefined || imageId === "" ? {} : { imageId }),
  };
}

export function bandCovering(bands: SliceBand[], index: number): SliceBand | undefined {
  return bands.find((band) => index >= band.start && index < band.start + band.count);
}

export function spanLabel(start: number, count: number): string {
  if (count <= 1) return `Slice ${start + 1}`;
  return `Slices ${start + 1}–${start + count}`;
}

export function clampBand(band: SliceBand, sliceCount: number): SliceBand | null {
  const start = Math.max(0, band.start);
  if (sliceCount < 1 || start >= sliceCount) return null;
  const count = Math.min(band.count, sliceCount - start);
  if (count < 1) return null;
  return { ...band, start, count };
}

export function normalizeBands(bands: SliceBand[], sliceCount: number): SliceBand[] {
  return bands
    .map((band) => clampBand(band, sliceCount))
    .filter((band): band is SliceBand => band !== null)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** Grow or shrink a consecutive span by clicking a slice index. */
export function nextCoverage(
  start: number,
  count: number,
  clicked: number,
  sliceCount: number,
): { start: number; count: number } {
  const from = Math.max(0, start);
  const to = from + Math.max(1, count) - 1;
  const index = Math.max(0, Math.min(sliceCount - 1, clicked));
  if (index >= from && index <= to) {
    if (index === from && to > from) return { start: from + 1, count: to - from };
    if (index === to && to > from) return { start: from, count: to - from };
    if (index > from && index < to) return { start: from, count: index - from + 1 };
    return { start: from, count: to - from + 1 };
  }
  const nextStart = Math.min(from, index);
  const nextEnd = Math.max(to, index);
  return { start: nextStart, count: nextEnd - nextStart + 1 };
}

export function setBandSpan(
  bands: SliceBand[],
  target: SliceBand,
  start: number,
  count: number,
  sliceCount: number,
): SliceBand[] {
  const clamped = clampBand({ ...target, start, count }, sliceCount);
  if (clamped === null) return normalizeBands(bands, sliceCount);
  const rangeStart = clamped.start;
  const rangeEnd = clamped.start + clamped.count;
  const next: SliceBand[] = [];
  for (const band of bands) {
    if (band.id === target.id) continue;
    const bandEnd = band.start + band.count;
    if (band.start >= rangeStart && bandEnd <= rangeEnd) continue;
    if (band.start < rangeStart && bandEnd > rangeEnd) {
      const leftCount = rangeStart - band.start;
      if (leftCount >= 1) next.push({ ...band, count: leftCount });
      const rightStart = rangeEnd;
      const rightCount = bandEnd - rightStart;
      if (rightCount >= 1) {
        next.push({
          ...band,
          id: `${band.id}-r`,
          start: rightStart,
          count: rightCount,
        });
      }
      continue;
    }
    if (band.start < rangeStart && bandEnd > rangeStart) {
      const leftCount = rangeStart - band.start;
      if (leftCount >= 1) next.push({ ...band, count: leftCount });
      continue;
    }
    if (band.start < rangeEnd && bandEnd > rangeEnd) {
      const rightStart = rangeEnd;
      const rightCount = bandEnd - rightStart;
      if (rightCount >= 1) next.push({ ...band, start: rightStart, count: rightCount });
      continue;
    }
    next.push(band);
  }
  next.push(clamped);
  return normalizeBands(next, sliceCount);
}

export function patchBand(
  bands: SliceBand[],
  id: string,
  patch: Partial<Pick<SliceBand, "color" | "imageId">>,
): SliceBand[] {
  return bands.map((band) => {
    if (band.id !== id) return band;
    const next: SliceBand = { ...band };
    if (patch.color !== undefined) next.color = patch.color;
    if ("imageId" in patch) {
      if (patch.imageId === undefined || patch.imageId === "") delete next.imageId;
      else next.imageId = patch.imageId;
    }
    return next;
  });
}

export function removeBand(bands: SliceBand[], id: string): SliceBand[] {
  return bands.filter((band) => band.id !== id);
}

/** Insert copies of a slice range immediately after it, shifting later bands right. */
export function duplicateSliceRange(
  bands: SliceBand[],
  start: number,
  count: number,
  sliceCount: number,
): SliceBand[] {
  const insertAt = start + count;
  if (count < 1) return normalizeBands(bands, sliceCount);
  const next: SliceBand[] = [];
  for (const band of bands) {
    const bandEnd = band.start + band.count;
    if (bandEnd <= insertAt) next.push(band);
    else if (band.start >= insertAt) next.push({ ...band, start: band.start + count });
    else next.push({ ...band, count: band.count + count });
    if (band.start >= start && bandEnd <= insertAt) {
      next.push({
        id: `band-${crypto.randomUUID().slice(0, 8)}`,
        start: insertAt + (band.start - start),
        count: band.count,
        color: band.color,
        ...(band.imageId === undefined ? {} : { imageId: band.imageId }),
      });
    }
  }
  return normalizeBands(next, sliceCount + count);
}

/** Drop a consecutive slice range and shift later bands left. */
export function removeSliceRange(
  bands: SliceBand[],
  start: number,
  count: number,
  sliceCount: number,
): SliceBand[] {
  const delStart = Math.max(0, start);
  const delCount = Math.max(0, count);
  const delEnd = delStart + delCount;
  if (delCount < 1) return normalizeBands(bands, sliceCount);
  const next: SliceBand[] = [];
  for (const band of bands) {
    const bandEnd = band.start + band.count;
    const overlap = Math.max(0, Math.min(bandEnd, delEnd) - Math.max(band.start, delStart));
    const remaining = band.count - overlap;
    if (remaining < 1) continue;
    let nextStart = band.start;
    if (band.start >= delEnd) nextStart = band.start - delCount;
    else if (band.start >= delStart) nextStart = delStart;
    next.push({ ...band, start: nextStart, count: remaining });
  }
  return normalizeBands(next, Math.max(1, sliceCount - delCount));
}
