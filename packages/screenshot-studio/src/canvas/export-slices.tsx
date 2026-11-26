import { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Konva from "konva";
import { Layer, Stage } from "react-konva";

import { BoardContent } from "@/canvas/board-content";
import { boardCollections, collectionAsBoard, nodesInCollection } from "@/lib/scenes";
import { fileSlug } from "@/lib/store-rules";
import { assetUrl, boardFillFor, boardSize, type StudioSnapshot } from "@/lib/studio";
import { dataUrlToBytes, downloadBlob, zipStore } from "@/lib/zip";

const IMAGE_LOAD_TIMEOUT_MS = 10_000;

interface SnapshotImage {
  url: string;
  label: string;
}

function snapshotImages(snapshot: StudioSnapshot): SnapshotImage[] {
  const images: SnapshotImage[] = [];
  const add = (id: string | undefined, label: string) => {
    const url = assetUrl(snapshot.assets, id);
    if (url !== "") images.push({ url, label });
  };

  const fill = boardFillFor(snapshot.board);
  add(fill.imageId, "board background");
  for (const band of fill.bands) add(band.imageId, `background band ${band.id}`);
  for (const node of snapshot.nodes) {
    if (node.hidden) continue;
    if (node.type === "device") add(node.screenAssetId, `${node.name} screen`);
    if (node.type === "shape") add(node.imageId, `${node.name} image`);
  }
  return images;
}

function preloadImage({ url, label }: SnapshotImage): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    let settled = false;
    const finish = (cause?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (cause === undefined) resolve();
      else reject(cause);
    };
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out loading image for ${label}`)),
      IMAGE_LOAD_TIMEOUT_MS,
    );
    const decode = () => {
      if (image.naturalWidth < 1 || image.naturalHeight < 1) {
        finish(new Error(`Image for ${label} has no readable dimensions`));
        return;
      }
      try {
        const decoded = image.decode();
        void decoded.then(
          () => finish(),
          () => finish(new Error(`Could not decode image for ${label}`)),
        );
      } catch {
        finish(new Error(`Could not decode image for ${label}`));
      }
    };
    image.onload = decode;
    image.onerror = () => finish(new Error(`Could not load image for ${label}`));
    image.decoding = "async";
    image.src = url;
    if (image.complete) decode();
  });
}

async function preloadSnapshotImages(images: SnapshotImage[]): Promise<void> {
  const unique = new Map<string, SnapshotImage>();
  for (const image of images) {
    if (!unique.has(image.url)) unique.set(image.url, image);
  }
  await Promise.all(Array.from(unique.values(), preloadImage));
}

function waitForPaint(stage: Konva.Stage, expectedImageCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let frames = 0;
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(cause);
    };
    const timeout = window.setTimeout(
      () =>
        fail(
          new Error(
            expectedImageCount === 0
              ? "Timed out waiting for the export canvas to paint"
              : `Timed out waiting for ${expectedImageCount} snapshot images to mount`,
          ),
        ),
      IMAGE_LOAD_TIMEOUT_MS,
    );
    const tick = () => {
      if (settled) return;
      frames += 1;
      const images = stage.find("Image").map((node) => (node as Konva.Image).image());
      const mounted =
        images.length === expectedImageCount &&
        images.every(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        );
      if (mounted && frames >= 2) {
        void (async () => {
          try {
            for (const image of images) {
              if (image instanceof HTMLImageElement) await image.decode();
            }
            done();
          } catch {
            fail(new Error("Could not decode a mounted snapshot image"));
          }
        })();
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function collectionSnapshots(snapshot: StudioSnapshot): StudioSnapshot[] {
  const collections = boardCollections(snapshot.board);
  const fallbackId = collections[0]?.id ?? "col-main";
  return collections.map((collection) => ({
    ...snapshot,
    board: {
      ...collectionAsBoard(snapshot.board, collection),
      name: `${snapshot.board.name} · ${collection.name}`,
    },
    nodes: nodesInCollection(snapshot.nodes, collection.id, fallbackId),
  }));
}

function ExportStage({
  snapshot,
  expectedImageCount,
  onDone,
  onError,
}: {
  snapshot: StudioSnapshot;
  expectedImageCount: number;
  onDone: (files: { name: string; dataUrl: string }[]) => void;
  onError: (cause: unknown) => void;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const collection = boardCollections(snapshot.board)[0];
  const size = boardSize(snapshot.board);
  const preset = { ...size, sliceCount: snapshot.board.sliceCount };

  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stage = stageRef.current;
        if (stage === null) throw new Error("Export canvas failed to mount");
        await waitForPaint(stage, expectedImageCount);
        if (cancelled) return;
        const slug = fileSlug(snapshot.board.name);
        const files: { name: string; dataUrl: string }[] = [];
        const pad = String(preset.sliceCount).length;
        for (let index = 0; index < preset.sliceCount; index += 1) {
          stage.x(-index * preset.width);
          stage.draw();
          files.push({
            name: `${slug}-${String(index + 1).padStart(Math.max(2, pad), "0")}.png`,
            dataUrl: stage.toDataURL({
              mimeType: "image/png",
              pixelRatio: 1,
              x: 0,
              y: 0,
              width: preset.width,
              height: preset.height,
            }),
          });
        }
        onDone(files);
      } catch (cause: unknown) {
        if (!cancelled) onError(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    expectedImageCount,
    onDone,
    onError,
    preset.height,
    preset.sliceCount,
    preset.width,
    snapshot,
  ]);

  return (
    <Stage ref={stageRef} width={preset.width} height={preset.height} listening={false}>
      <Layer listening={false}>
        <BoardContent
          board={snapshot.board}
          nodes={snapshot.nodes}
          assets={snapshot.assets}
          interactive={false}
          collectionId={collection?.id}
          onSelect={() => {}}
        />
      </Layer>
    </Stage>
  );
}

async function exportOneStrip(
  snapshot: StudioSnapshot,
): Promise<{ name: string; dataUrl: string }[]> {
  const images = snapshotImages(snapshot);
  await preloadSnapshotImages(images);
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-12000px;top:0;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.unmount();
      host.remove();
    };
    try {
      root.render(
        <ExportStage
          snapshot={snapshot}
          expectedImageCount={images.length}
          onDone={(files) => {
            finish();
            resolve(files);
          }}
          onError={(cause) => {
            finish();
            reject(cause);
          }}
        />,
      );
    } catch (cause: unknown) {
      finish();
      reject(cause);
    }
  });
}

/** Render every scene collection and return one PNG data URL per slice. */
export async function exportSnapshotSlices(
  snapshot: StudioSnapshot,
): Promise<{ name: string; dataUrl: string }[]> {
  const strips = collectionSnapshots(snapshot);
  const nested = strips.length > 1;
  const files: { name: string; dataUrl: string }[] = [];
  for (const strip of strips) {
    const slices = await exportOneStrip(strip);
    const folder = fileSlug(strip.board.name);
    for (const slice of slices) {
      files.push({
        name: nested ? `${folder}/${slice.name}` : slice.name,
        dataUrl: slice.dataUrl,
      });
    }
  }
  return files;
}

export async function downloadSnapshotsZip(
  snapshots: StudioSnapshot[],
  filename: string,
): Promise<void> {
  if (snapshots.length === 0) throw new Error("Nothing to export");
  const nestedBoards = snapshots.length > 1;
  const entries = [];
  for (const snapshot of snapshots) {
    const slices = await exportSnapshotSlices(snapshot);
    const boardFolder = fileSlug(snapshot.board.name);
    for (const slice of slices) {
      entries.push({
        name: nestedBoards ? `${boardFolder}/${slice.name}` : slice.name,
        data: dataUrlToBytes(slice.dataUrl),
      });
    }
  }
  downloadBlob(new Blob([zipStore(entries) as BlobPart], { type: "application/zip" }), filename);
}
