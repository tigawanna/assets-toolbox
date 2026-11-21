export interface Palette {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

interface Sample {
  r: number;
  g: number;
  b: number;
}

function hex({ r, g, b }: Sample): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function saturation({ r, g, b }: Sample): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Tiny k-means over a downscaled image. Returns theme token proposals. */
export function extractPalette(image: HTMLImageElement, k = 4): Palette {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2D canvas is unavailable");
  ctx.drawImage(image, 0, 0, 48, 48);
  const { data } = ctx.getImageData(0, 0, 48, 48);
  const pixels: Sample[] = [];
  for (let i = 0; i < data.length; i += 16) {
    if ((data[i + 3] ?? 0) < 128) continue;
    pixels.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
  }
  if (pixels.length === 0) {
    return { primary: "#635bff", accent: "#ffb86b", background: "#0f100f", text: "#f7f7f3" };
  }

  let centers: Sample[] = pixels
    .filter((_, index) => index % Math.max(1, Math.floor(pixels.length / k)) === 0)
    .slice(0, k);
  let buckets: Sample[][] = centers.map(() => []);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    buckets = centers.map(() => []);
    for (const pixel of pixels) {
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      centers.forEach((center, index) => {
        const distance =
          (pixel.r - center.r) ** 2 + (pixel.g - center.g) ** 2 + (pixel.b - center.b) ** 2;
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      buckets[nearest]?.push(pixel);
    }
    centers = centers.map((center, index) => {
      const bucket = buckets[index] ?? [];
      if (bucket.length === 0) return center;
      return {
        r: bucket.reduce((sum, pixel) => sum + pixel.r, 0) / bucket.length,
        g: bucket.reduce((sum, pixel) => sum + pixel.g, 0) / bucket.length,
        b: bucket.reduce((sum, pixel) => sum + pixel.b, 0) / bucket.length,
      };
    });
  }

  const ranked = centers
    .map((center, index) => ({ center, count: buckets[index]?.length ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const dominant = ranked[0]?.center ?? centers[0] ?? { r: 99, g: 91, b: 255 };
  const accent = [...centers].sort((a, b) => saturation(b) - saturation(a))[0] ?? dominant;
  const luminance = (0.2126 * dominant.r + 0.7152 * dominant.g + 0.0722 * dominant.b) / 255;
  return {
    primary: hex(dominant),
    accent: hex(accent),
    background: luminance > 0.5 ? "#101114" : "#f5f5f0",
    text: luminance > 0.5 ? "#f7f7f3" : "#141414",
  };
}
