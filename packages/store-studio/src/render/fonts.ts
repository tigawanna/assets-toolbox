/** FontFace loading — export waits for these before any draw. */
const loaded = new Set<string>();

export async function loadFont(family: string, url: string, weight = "400"): Promise<void> {
  const key = `${family}:${weight}`;
  if (loaded.has(key) || typeof document === "undefined") return;
  const face = new FontFace(family, `url(${url})`, { weight });
  await face.load();
  document.fonts.add(face);
  loaded.add(key);
}

export async function awaitFonts(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts !== undefined) await document.fonts.ready;
}
