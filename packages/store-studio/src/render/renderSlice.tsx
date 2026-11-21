import { createRoot, type Root } from "react-dom/client";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { BoardRenderer } from "../canvas/BoardRenderer";
import type { Board, StudioProject } from "../model/schema";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForImages(stage: Konva.Stage, timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const images = stage.find("Image") as Konva.Image[];
    const pending = images.filter((node) => {
      const image = node.image() as (HTMLImageElement & { complete?: boolean }) | undefined;
      return image === undefined || image.complete !== true;
    });
    if (pending.length === 0) return;
    await wait(60);
  }
}

/**
 * Render one slice on a fresh, exact-size offscreen stage. The board is shifted
 * by -i·sliceWidth, so view zoom never affects output and no giant canvas is
 * allocated. This is the same component the viewport uses.
 */
export async function renderSlice(
  project: StudioProject,
  board: Board,
  index: number,
): Promise<Blob> {
  if (typeof document === "undefined" || typeof document.fonts === "undefined") {
    throw new Error("renderSlice needs a browser document with the FontFace API.");
  }
  await document.fonts.ready;

  const preset = getPreset(board.preset);
  const container = document.createElement("div");
  container.setAttribute("data-store-studio-export", "");
  container.style.position = "fixed";
  container.style.left = "-20000px";
  container.style.top = "0";
  document.body.appendChild(container);

  const root: Root = createRoot(container);
  let stage: Konva.Stage | null = null;
  try {
    root.render(
      <Stage
        ref={(instance) => {
          stage = instance;
        }}
        width={preset.width}
        height={preset.height}
        listening={false}
      >
        <Layer listening={false}>
          <BoardRenderer
            board={board}
            tokens={project.theme.tokens}
            offsetX={index * preset.width}
          />
        </Layer>
      </Stage>,
    );
    // React 19 commits asynchronously; poll briefly for the Stage ref.
    const mountDeadline = Date.now() + 5000;
    while (stage === null && Date.now() < mountDeadline) await wait(20);
    if (stage === null) throw new Error("Export stage did not mount");
    await waitForImages(stage as Konva.Stage);
    const canvas = (stage as Konva.Stage).toCanvas({
      x: 0,
      y: 0,
      width: preset.width,
      height: preset.height,
      pixelRatio: 1,
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob === null) throw new Error("Could not encode the export canvas as PNG");
    return blob;
  } finally {
    root.unmount();
    container.remove();
  }
}
