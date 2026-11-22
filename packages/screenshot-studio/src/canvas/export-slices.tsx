import { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Konva from "konva";
import { Layer, Stage } from "react-konva";

import { BoardContent } from "@/canvas/board-content";
import {
  boardCollections,
  collectionAsBoard,
  nodesInCollection,
} from "@/lib/scenes";
import { fileSlug } from "@/lib/store-rules";
import { boardSize, type StudioSnapshot } from "@/lib/studio";
import { dataUrlToBytes, downloadBlob, zipStore } from "@/lib/zip";

function waitForPaint(stage: Konva.Stage): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0;
    const tick = () => {
      frames += 1;
      const pending = stage.find("Image").some((node) => {
        const image = (node as Konva.Image).image();
        return image instanceof HTMLImageElement && !image.complete;
      });
      if (!pending && frames >= 2) {
        resolve();
        return;
      }
      if (frames > 90) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
  onDone,
  onError,
}: {
  snapshot: StudioSnapshot;
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
        await waitForPaint(stage);
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
        onError(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDone, onError, preset.height, preset.sliceCount, preset.width, snapshot]);

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

function exportOneStrip(snapshot: StudioSnapshot): Promise<{ name: string; dataUrl: string }[]> {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-12000px;top:0;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = () => {
      root.unmount();
      host.remove();
    };
    root.render(
      <ExportStage
        snapshot={snapshot}
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
