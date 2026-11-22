import { count } from "@tanstack/db";
import { HotkeysProvider, useHotkeys, useFormatForDisplay } from "@tanstack/react-hotkeys";
import { useLiveQuery } from "@tanstack/react-db";
import { Link } from "@tanstack/react-router";
import {
  Download,
  Library,
  LocateFixed,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  RotateCw,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { downloadSnapshotsZip } from "@/canvas/export-slices";
import { CanvasHost } from "@/canvas/canvas-host";
import { ScreenshotStudioIcon } from "@/components/brand-icon";
import { BoardCloneMenu } from "@/components/board-clone-menu";
import { SettingsDrawer } from "@/components/settings-drawer";
import { AssetsDrawer } from "@/components/panels/assets-panel";
import { DevicesPanel } from "@/components/panels/devices-panel";
import { readImageFile } from "@/components/panels/fill-picker";
import { HistoryDrawer } from "@/components/panels/history-drawer";
import { Inspector } from "@/components/panels/inspector";
import { LayersPanel } from "@/components/panels/layers-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { DeviceModelId } from "@/devices/catalog";
import {
  bandCovering,
  bandSelectionId,
  createSliceBand,
  nextCoverage,
  parseBandSelection,
  parseSliceSelection,
  patchBand,
  removeBand,
  setBandSpan,
  sliceSelectionId,
} from "@/lib/bands";
import { listPresets } from "@/lib/presets";
import {
  boardCollections,
  collectionAsBoard,
  collectionFill,
  collectionSelectionId,
  FIT_CAMERA_EVENT,
  parseCollectionSelection,
  patchCollection,
  removeSceneCollection,
  selectionCollection,
} from "@/lib/scenes";
import { fileSlug } from "@/lib/store-rules";
import {
  DEFAULT_BOARD_ID,
  MAX_SLICES,
  defaultBoard,
  layerOrder,
  moveLayer,
  writeBoardFill,
  type ShapeKind,
  type StoreName,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";
import {
  appendEvents,
  applySnapshot,
  assetsCollection,
  clearStudio,
  mergeSnapshot,
  boardCollection,
  dropNode,
  eventsCollection,
  nodesCollection,
  pruneNodes,
  replaceAsset,
  replaceBoard,
  replaceNode,
} from "@/lib/studio-collections";
import {
  addAsset,
  addDevice,
  addDevicePair,
  addLine,
  addOverlay,
  addText,
  applyStore,
  cloneCollection,
  focusBoard,
  cloneSelectedNode,
  cloneSlices,
  deleteSlices,
  loadStudio,
  patchBoard,
  patchNode,
  removeCollection,
  removeNode,
  reorderStack,
  restoreHistory,
  undoEvent,
} from "@/server/fns";

function busyLabel(busy: string): string {
  if (busy === "delete-strip") return "Deleting strip…";
  if (busy === "clone") return "Duplicating strip…";
  if (busy === "export") return "Exporting…";
  return "Working…";
}

export function Studio({ projectId }: { projectId: string }) {
  return (
    <HotkeysProvider>
      <StudioShell key={projectId} projectId={projectId} />
    </HotkeysProvider>
  );
}

function StudioShell({ projectId }: { projectId: string }) {
  const boardQuery = useLiveQuery((q) => q.from({ board: boardCollection }));
  const nodeQuery = useLiveQuery((q) => q.from({ node: nodesCollection }));
  const assetQuery = useLiveQuery((q) => q.from({ asset: assetsCollection }));
  const recentEvents = useLiveQuery((q) =>
    q.from({ event: eventsCollection }).orderBy(({ event }) => event.seq, "desc"),
  );
  const eventTotal = useLiveQuery((q) =>
    q.from({ event: eventsCollection }).select(({ event }) => ({ total: count(event.id) })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [nameDraft, setNameDraft] = useState("Untitled");
  const [stripDraft, setStripDraft] = useState("Scenes");
  const [busy, setBusy] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const undoRef = useRef<() => void>(() => {});
  const undoing = useRef(false);
  const nameTimer = useRef(0);
  const stripTimer = useRef(0);
  const formatHotkey = useFormatForDisplay();
  const leftHint = formatHotkey("Mod+B");
  const rightHint = formatHotkey("Mod+L");
  const duplicateHint = formatHotkey("Mod+D");
  const undoHint = formatHotkey("Mod+Z");
  const presets = listPresets();
  const pid = { projectId };
  const board = boardQuery.data[0] ?? defaultBoard();
  const nodes = nodeQuery.data ?? [];
  const assets = assetQuery.data ?? [];
  const activeCollection = selectionCollection(board, nodes, selectedId);
  const fill = collectionFill(activeCollection);
  const selectedBandId = parseBandSelection(selectedId);
  const selectedBand =
    selectedBandId === null ? undefined : fill.bands.find((band) => band.id === selectedBandId);
  const parsedSlice = parseSliceSelection(selectedId);
  const selectedSlice =
    parsedSlice === null || parsedSlice.index >= activeCollection.sliceCount
      ? null
      : parsedSlice.index;
  let span: {
    start: number;
    count: number;
    color: string;
    imageId?: string;
    bandId?: string;
  } | null = null;
  if (selectedBand !== undefined) {
    span = {
      start: selectedBand.start,
      count: selectedBand.count,
      color: selectedBand.color,
      imageId: selectedBand.imageId,
      bandId: selectedBand.id,
    };
  } else if (selectedSlice !== null) {
    span = { start: selectedSlice, count: 1, color: fill.color };
  }
  const collectionSelected = parseCollectionSelection(selectedId) === activeCollection.id;
  const boardSelected =
    span === null &&
    (selectedId === null ||
      selectedId === board.id ||
      selectedId === DEFAULT_BOARD_ID ||
      collectionSelected);
  const selected =
    boardSelected || span !== null ? null : (nodes.find((node) => node.id === selectedId) ?? null);
  let assetActiveId = span?.imageId ?? fill.imageId;
  if (selected?.type === "device") assetActiveId = selected.screenAssetId;
  if (selected?.type === "shape") assetActiveId = selected.imageId;
  const events = recentEvents.data ?? [];
  const total = eventTotal.data[0]?.total ?? 0;
  const playPresets = presets.filter((preset) => preset.store === "play");
  const appPresets = presets.filter((preset) => preset.store === "app-store");

  useHotkeys([
    { hotkey: "Mod+B", callback: () => setLeftOpen((open) => !open) },
    { hotkey: "Mod+L", callback: () => setRightOpen((open) => !open) },
    {
      hotkey: "Mod+D",
      callback: (event) => {
        event.preventDefault();
        if (selected !== null) void duplicateSelectedNode(selected.id);
        else if (span !== null) void duplicateSelectedSlice();
      },
    },
    {
      hotkey: "Mod+Z",
      callback: (event) => {
        event.preventDefault();
        undoRef.current();
      },
    },
  ]);

  useEffect(() => {
    void focusBoard({ data: { projectId } });
    const onFocus = () => {
      void focusBoard({ data: { projectId } });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setHydrated(false);
    void (async () => {
      await clearStudio();
      if (cancelled) return;
      try {
        const snapshot = await loadStudio({ data: { projectId } });
        if (cancelled) return;
        await applySnapshot(snapshot);
        if (!cancelled) setHydrated(true);
      } catch (cause: unknown) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const seqRef = useRef(0);
  seqRef.current = events[0]?.seq ?? total;

  useEffect(() => {
    if (!hydrated) return;
    const source = new EventSource(`/api/live?projectId=${encodeURIComponent(projectId)}`);
    source.onmessage = (event) => {
      let payload: { type?: string; seq?: number } = {};
      try {
        payload = JSON.parse(event.data) as { type?: string; seq?: number };
      } catch {
        return;
      }
      if (payload.type !== "change") return;
      if (typeof payload.seq === "number" && payload.seq <= seqRef.current) return;
      void loadStudio({ data: { projectId } }).then(mergeSnapshot);
    };
    return () => source.close();
  }, [hydrated, projectId]);

  useEffect(() => {
    setNameDraft(board.name);
  }, [board.name]);

  useEffect(() => {
    setStripDraft(activeCollection.name);
  }, [activeCollection.id, activeCollection.name]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        undoRef.current();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selected !== null) {
          event.preventDefault();
          void removeSelected(selected.id);
          return;
        }
        if (span !== null) {
          event.preventDefault();
          void deleteSelectedSlice();
          return;
        }
      }
      if (event.key.startsWith("Arrow") && selected !== null) {
        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (event.key === "ArrowLeft") dx = -step;
        else if (event.key === "ArrowRight") dx = step;
        else if (event.key === "ArrowUp") dy = -step;
        else if (event.key === "ArrowDown") dy = step;
        if (dx === 0 && dy === 0) return;
        event.preventDefault();
        void commitNode(selected.id, { x: selected.x + dx, y: selected.y + dy }, "Nudge", "move");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, span]);

  async function persist(work: () => Promise<StudioSnapshot>): Promise<StudioSnapshot> {
    setError("");
    try {
      const snapshot = await work();
      await replaceBoard(snapshot.board);
      await appendEvents(snapshot.events);
      await Promise.all(snapshot.assets.map((asset) => replaceAsset(asset)));
      await pruneNodes(new Set(snapshot.nodes.map((node) => node.id)));
      await Promise.all(snapshot.nodes.map((node) => replaceNode(node)));
      return snapshot;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save");
      throw cause;
    }
  }

  async function persistLive(work: () => Promise<StudioSnapshot>, live: () => Promise<void>) {
    setError("");
    try {
      await live();
      const snapshot = await work();
      await replaceBoard(snapshot.board);
      await appendEvents(snapshot.events);
      await Promise.all(snapshot.assets.map((asset) => replaceAsset(asset)));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    }
  }

  function markBusy(next: string) {
    flushSync(() => setBusy(next));
  }

  async function commitNode(
    id: string,
    patch: Record<string, unknown>,
    label: string,
    kind: "edit" | "move" | "transform" = "edit",
  ) {
    const current = nodes.find((node) => node.id === id);
    if (current === undefined) return;
    const next = { ...current, ...patch, id: current.id, type: current.type } as StudioNode;
    await persistLive(
      () => patchNode({ data: { ...pid, id, patch, label, kind } }),
      () => replaceNode(next),
    );
  }

  async function removeSelected(id: string) {
    setSelectedId(null);
    await persistLive(
      () => removeNode({ data: { ...pid, id } }),
      () => dropNode(id),
    );
  }

  async function commitBoardName(raw: string) {
    window.clearTimeout(nameTimer.current);
    const name = raw.trim() === "" ? "Untitled" : raw.trim();
    setNameDraft(name);
    if (name === board.name) return;
    try {
      await persistLive(
        () => patchBoard({ data: { ...pid, name } }),
        () => replaceBoard({ ...board, name }),
      );
    } catch (cause: unknown) {
      setNameDraft(board.name);
      setError(cause instanceof Error ? cause.message : "Could not rename");
    }
  }

  function queueBoardName(raw: string) {
    setNameDraft(raw);
    window.clearTimeout(nameTimer.current);
    nameTimer.current = window.setTimeout(() => {
      void commitBoardName(raw);
    }, 400);
  }

  async function commitStripName(raw: string) {
    window.clearTimeout(stripTimer.current);
    const name = raw.trim() === "" ? activeCollection.name : raw.trim();
    setStripDraft(name);
    if (name === activeCollection.name) return;
    try {
      await persistLive(
        () =>
          patchBoard({
            data: { ...pid, collectionId: activeCollection.id, name },
          }),
        () => replaceBoard(patchCollection(board, activeCollection.id, { name })),
      );
    } catch (cause: unknown) {
      setStripDraft(activeCollection.name);
      setError(cause instanceof Error ? cause.message : "Could not rename strip");
    }
  }

  function queueStripName(raw: string) {
    setStripDraft(raw);
    window.clearTimeout(stripTimer.current);
    stripTimer.current = window.setTimeout(() => {
      void commitStripName(raw);
    }, 400);
  }

  async function moveCollection(id: string, x: number, y: number) {
    await persistLive(
      () => patchBoard({ data: { ...pid, collectionId: id, x, y } }),
      () => replaceBoard(patchCollection(board, id, { x, y })),
    );
  }

  async function createOverlay(
    kind: "shape" | "image",
    imageId?: string,
    assetName?: string,
    shape?: ShapeKind,
  ) {
    try {
      const snapshot = await persist(() =>
        addOverlay({
          data: {
            ...pid,
            kind,
            shape,
            slice: span?.start ?? 0,
            collectionId: activeCollection.id,
            targetId: selected?.type === "device" ? selected.id : undefined,
            imageId,
            assetName,
          },
        }),
      );
      const addedId = snapshot.events.at(-1)?.nodeId;
      if (addedId !== undefined && addedId !== "") setSelectedId(addedId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : `Could not add ${kind}`);
    }
  }

  async function createLine(smooth: boolean) {
    try {
      const snapshot = await persist(() =>
        addLine({
          data: {
            ...pid,
            smooth,
            slice: span?.start ?? 0,
            collectionId: activeCollection.id,
            targetId: selected?.type === "device" ? selected.id : undefined,
          },
        }),
      );
      const addedId = snapshot.events.at(-1)?.nodeId;
      if (addedId !== undefined && addedId !== "") setSelectedId(addedId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not add line");
    }
  }

  function applyAsset(id: string) {
    if (selected !== null && selected.type === "shape") {
      void commitNode(selected.id, { imageId: id }, "Overlay image");
      return;
    }
    if (selected !== null && selected.type === "device") {
      void createOverlay("image", id, assets.find((asset) => asset.id === id)?.name);
      return;
    }
    if (span !== null) {
      void commitSliceFill(span.color, id);
      return;
    }
    void commitBoardFill(fill.color, id);
  }

  async function commitFill(next = fill) {
    try {
      await persist(() =>
        patchBoard({
          data: {
            ...pid,
            collectionId: activeCollection.id,
            background: writeBoardFill({ ...next, bands: next.bands }),
          },
        }),
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    }
  }

  async function commitBoardFill(color: string, imageId?: string) {
    await commitFill({ ...fill, color, imageId });
  }

  async function commitSliceFill(color: string, imageId?: string) {
    if (selectedBand !== undefined) {
      await commitFill({
        ...fill,
        bands: patchBand(fill.bands, selectedBand.id, { color, imageId }),
      });
      return;
    }
    if (selectedSlice === null) return;
    const band = createSliceBand(selectedSlice, 1, color, imageId);
    await commitFill({
      ...fill,
      bands: setBandSpan(fill.bands, band, band.start, band.count, activeCollection.sliceCount),
    });
    setSelectedId(bandSelectionId(band.id));
  }

  async function commitSliceSpan(index: number) {
    if (selectedBand !== undefined) {
      const next = nextCoverage(
        selectedBand.start,
        selectedBand.count,
        index,
        activeCollection.sliceCount,
      );
      await commitFill({
        ...fill,
        bands: setBandSpan(
          fill.bands,
          selectedBand,
          next.start,
          next.count,
          activeCollection.sliceCount,
        ),
      });
      return;
    }
    if (selectedSlice === null) return;
    const next = nextCoverage(selectedSlice, 1, index, activeCollection.sliceCount);
    const band = createSliceBand(next.start, next.count, fill.color, fill.imageId);
    await commitFill({
      ...fill,
      bands: setBandSpan(fill.bands, band, band.start, band.count, activeCollection.sliceCount),
    });
    setSelectedId(bandSelectionId(band.id));
  }

  async function resetSlice() {
    if (selectedBand === undefined) return;
    const start = selectedBand.start;
    await commitFill({ ...fill, bands: removeBand(fill.bands, selectedBand.id) });
    setSelectedId(sliceSelectionId(activeCollection.id, start));
  }

  async function deleteSelectedSlice() {
    if (span === null) return;
    if (activeCollection.sliceCount <= 1 || span.count >= activeCollection.sliceCount) return;
    setSelectedId(null);
    try {
      await persist(() =>
        deleteSlices({
          data: {
            ...pid,
            start: span.start,
            count: span.count,
            collectionId: activeCollection.id,
          },
        }),
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not delete slice");
    }
  }

  async function duplicateSelectedSlice() {
    if (span === null) return;
    if (activeCollection.sliceCount + span.count > MAX_SLICES) return;
    const copyStart = span.start + span.count;
    try {
      await persist(() =>
        cloneSlices({
          data: {
            ...pid,
            start: span.start,
            count: span.count,
            collectionId: activeCollection.id,
          },
        }),
      );
      setSelectedId(sliceSelectionId(activeCollection.id, copyStart));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate slice");
    }
  }

  async function duplicateSelectedNode(id: string) {
    try {
      const snapshot = (await persist(() =>
        cloneSelectedNode({ data: { ...pid, id } }),
      )) as StudioSnapshot & {
        nodeId: string;
      };
      if (snapshot.nodeId !== undefined) setSelectedId(snapshot.nodeId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate");
    }
  }

  function stackNode(id: string, where: "front" | "back") {
    const order = layerOrder(nodes);
    void restack(moveLayer(order, id, where === "front" ? 0 : order.length - 1));
  }

  async function restack(ids: string[]) {
    const count = ids.length;
    await persistLive(
      () => reorderStack({ data: { ...pid, ids } }),
      async () => {
        for (const node of nodes) {
          const index = ids.indexOf(node.id);
          if (index < 0) continue;
          await replaceNode({ ...node, z: count - 1 - index });
        }
      },
    );
  }

  async function undoLast() {
    if (total < 1 || undoing.current) return;
    undoing.current = true;
    setError("");
    try {
      await applySnapshot(await undoEvent({ data: pid }));
      setSelectedId(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not undo");
    } finally {
      undoing.current = false;
    }
  }
  undoRef.current = () => {
    void undoLast();
  };

  async function restoreToEvent(seq: number) {
    setError("");
    try {
      await applySnapshot(await restoreHistory({ data: { ...pid, seq } }));
      setSelectedId(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not restore");
    }
  }

  async function reloadLatest() {
    setReloading(true);
    setError("");
    try {
      await applySnapshot(await loadStudio({ data: pid }));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not reload");
    } finally {
      setReloading(false);
    }
  }

  async function cloneCurrent(store?: StoreName, collectionId = activeCollection.id) {
    markBusy("clone");
    setError("");
    try {
      const snapshot = await persist(() =>
        cloneCollection({
          data: { ...pid, collectionId, store },
        }),
      );
      const added = boardCollections(snapshot.board).at(-1);
      if (added !== undefined) setSelectedId(collectionSelectionId(added.id));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not clone");
    } finally {
      setBusy("");
    }
  }

  async function deleteCurrentStrip(collectionId: string) {
    markBusy("delete-strip");
    setError("");
    const next = removeSceneCollection(board, nodes, collectionId);
    const remaining = boardCollections(next.board)[0];
    setSelectedId(remaining === undefined ? null : collectionSelectionId(remaining.id));
    try {
      await persistLive(
        () => removeCollection({ data: { ...pid, collectionId } }),
        async () => {
          await replaceBoard(next.board);
          await pruneNodes(new Set(next.nodes.map((node) => node.id)));
        },
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not delete strip");
    } finally {
      setBusy("");
    }
  }

  async function applyStoreRules(store: StoreName) {
    try {
      await persist(() =>
        applyStore({ data: { ...pid, store, collectionId: activeCollection.id } }),
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not apply store rules");
    }
  }

  async function exportCollection() {
    markBusy("export");
    setError("");
    try {
      await downloadSnapshotsZip([{ board, nodes, events, assets }], `${fileSlug(board.name)}.zip`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not export");
    } finally {
      setBusy("");
    }
  }

  function selectCanvas(id: string | null) {
    if (id === null) {
      setSelectedId(null);
      return;
    }
    const slice = parseSliceSelection(id);
    if (slice !== null) {
      const covering = bandCovering(
        collectionFill(selectionCollection(board, nodes, id)).bands,
        slice.index,
      );
      setSelectedId(covering === undefined ? id : bandSelectionId(covering.id));
      return;
    }
    setSelectedId(id);
  }

  async function importImage(
    file: File,
    apply?: "board" | "device" | "band" | "overlay",
    shape?: ShapeKind,
  ) {
    try {
      const data = await readImageFile(file);
      const snapshot = (await addAsset({
        data: { ...pid, name: file.name, mime: file.type || "image/png", data },
      })) as StudioSnapshot & { assetId: string };
      await persist(async () => snapshot);
      const assetId = snapshot.assetId;
      if (assetId === undefined) return;
      if (apply === "board") {
        await commitBoardFill(fill.color, assetId);
      }
      if (apply === "band") {
        await commitSliceFill(span?.color ?? fill.color, assetId);
      }
      if (apply === "device" && selected !== null && selected.type === "device") {
        await commitNode(selected.id, { screenAssetId: assetId }, "Screen image");
      }
      if (apply === "overlay") {
        if (selected !== null && selected.type === "shape") {
          await commitNode(
            selected.id,
            { imageId: assetId, ...(shape === undefined ? {} : { shape }) },
            "Overlay image",
          );
        } else {
          await createOverlay("image", assetId, file.name, shape);
        }
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not import");
    }
  }

  if (!hydrated) {
    return (
      <div className="grid h-screen place-items-center bg-background text-sm text-muted-foreground">
        {error === "" ? "Opening board…" : error}
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="no-scrollbar flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border px-3">
        <Link to="/" title="Screenshot Studio boards" aria-label="Screenshot Studio boards">
          <ScreenshotStudioIcon className="size-6" />
        </Link>
        <Link
          to="/"
          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Boards
        </Link>
        <span className="text-muted-foreground">/</span>
        <Input
          aria-label="Board name"
          value={nameDraft}
          onChange={(event) => queueBoardName(event.target.value)}
          onBlur={(event) => void commitBoardName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitBoardName(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              window.clearTimeout(nameTimer.current);
              setNameDraft(board.name);
              event.currentTarget.blur();
            }
          }}
          className="h-8 max-w-48 min-w-24 border-transparent bg-transparent px-2 text-sm tracking-tight shadow-none hover:border-border focus-visible:border-ring"
        />
        <span className="text-muted-foreground">/</span>
        <Input
          aria-label="Scene strip name"
          data-testid="header-strip-name"
          value={stripDraft}
          onChange={(event) => queueStripName(event.target.value)}
          onBlur={(event) => void commitStripName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitStripName(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              window.clearTimeout(stripTimer.current);
              setStripDraft(activeCollection.name);
              event.currentTarget.blur();
            }
          }}
          className="h-8 max-w-52 min-w-28 border-transparent bg-transparent px-2 text-sm tracking-tight shadow-none hover:border-border focus-visible:border-ring"
        />
        <select
          aria-label="Scene size"
          className="h-8 min-w-0 rounded-md border border-border bg-popover px-2 text-sm"
          value={`${activeCollection.store}:${activeCollection.presetId}`}
          onChange={(event) => {
            const raw = event.target.value;
            const sep = raw.indexOf(":");
            const store = raw.slice(0, sep) as "play" | "app-store";
            const presetId = raw.slice(sep + 1);
            void persist(() =>
              patchBoard({
                data: { ...pid, collectionId: activeCollection.id, store, presetId },
              }),
            ).catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "Could not save"),
            );
          }}
        >
          <optgroup label="Google Play">
            {playPresets.map((preset) => (
              <option key={`play:${preset.id}`} value={`play:${preset.id}`}>
                {preset.label} · {preset.width}×{preset.height}
              </option>
            ))}
          </optgroup>
          <optgroup label="App Store">
            {appPresets.map((preset) => (
              <option key={`app-store:${preset.id}`} value={`app-store:${preset.id}`}>
                {preset.label} · {preset.width}×{preset.height}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant="outline"
            size="xs"
            title="Remove the last slice"
            disabled={activeCollection.sliceCount <= 1}
            onClick={() =>
              void persist(() =>
                deleteSlices({
                  data: {
                    ...pid,
                    start: activeCollection.sliceCount - 1,
                    count: 1,
                    collectionId: activeCollection.id,
                  },
                }),
              )
            }
          >
            −
          </Button>
          <span className="min-w-16 text-center text-xs text-muted-foreground">
            {activeCollection.sliceCount} slices
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              void persist(() =>
                patchBoard({
                  data: {
                    ...pid,
                    collectionId: activeCollection.id,
                    sliceCount: Math.min(MAX_SLICES, activeCollection.sliceCount + 1),
                  },
                }),
              )
            }
          >
            +
          </Button>
        </div>
        <BoardCloneMenu
          disabled={busy !== ""}
          onDuplicate={() => void cloneCurrent()}
          onCloneStore={(store) => void cloneCurrent(store)}
        />
        <Button
          variant="ghost"
          size="xs"
          data-testid="export-board"
          disabled={busy !== ""}
          title="Download every scene strip on this board as PNGs"
          onClick={() => void exportCollection()}
        >
          <Download />
          {busy === "export" ? "Exporting" : "Export"}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          data-testid="recenter-board"
          title="Fit every scene strip in the view (0)"
          onClick={() => window.dispatchEvent(new Event(FIT_CAMERA_EVENT))}
        >
          <LocateFixed />
          Recenter
        </Button>
        <Button
          variant="ghost"
          size="xs"
          title={`Undo last change (${undoHint})`}
          disabled={total < 1}
          onClick={() => void undoLast()}
        >
          <Undo2 />
          Undo
        </Button>
        <Button
          variant="ghost"
          size="xs"
          title="Reload the saved board if the canvas looks stale"
          disabled={reloading}
          onClick={() => void reloadLatest()}
        >
          <RotateCw className={reloading ? "animate-spin" : undefined} />
          {reloading ? "Reloading" : "Reload"}
        </Button>
        <ThemeToggle />
        <SettingsDrawer projectId={projectId} align="header" />
      </header>
      {error === "" ? null : (
        <p className="border-b border-border px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="relative flex min-h-0 flex-1">
        {busy === "" ? null : (
          <div
            className="absolute inset-0 z-30 grid place-items-center bg-background/55 backdrop-blur-sm"
            data-testid="studio-busy"
          >
            <p className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-foreground">
              {busyLabel(busy)}
            </p>
          </div>
        )}
        {leftOpen ? (
          <aside className="flex w-66 shrink-0 flex-col overflow-hidden border-r border-border bg-linear-to-b from-popover to-background/95">
            <header className="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border/70 bg-background/25 px-2.5">
              <span className="flex items-center gap-2 px-1 text-xs font-semibold tracking-widest text-foreground/90 uppercase">
                <Library className="size-3.5 text-primary" aria-hidden />
                Library
              </span>
              <div className="flex items-center">
                <AssetsDrawer
                  assets={assets}
                  activeId={assetActiveId}
                  onImport={(file) => void importImage(file)}
                  onPick={applyAsset}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={`Hide library (${leftHint})`}
                  aria-label={`Hide library (${leftHint})`}
                  onClick={() => setLeftOpen(false)}
                >
                  <PanelLeftClose />
                </Button>
              </div>
            </header>
            <LayersPanel
              board={board}
              nodes={nodes}
              selectedId={boardSelected || span !== null ? null : selectedId}
              onSelect={setSelectedId}
              onPatch={(id, patch, label) => void commitNode(id, patch, label)}
              onRestack={(ids) => void restack(ids)}
              duplicateHint={duplicateHint}
              onDuplicateNode={(id) => void duplicateSelectedNode(id)}
              onRemoveNode={(id) => void removeSelected(id)}
              onDuplicateSlice={() => void duplicateSelectedSlice()}
              onDeleteSlice={() => void deleteSelectedSlice()}
              onDuplicateCollection={(id) => void cloneCurrent(undefined, id)}
              onRemoveCollection={(id) => void deleteCurrentStrip(id)}
            />
            <DevicesPanel
              onDevice={(model: DeviceModelId) =>
                void persist(() =>
                  addDevice({
                    data: {
                      ...pid,
                      model,
                      slice: span?.start ?? 0,
                      collectionId: activeCollection.id,
                    },
                  }),
                )
              }
              onPair={(android, apple) =>
                void persist(() =>
                  addDevicePair({
                    data: {
                      ...pid,
                      android,
                      apple,
                      slice: span?.start ?? 0,
                      collectionId: activeCollection.id,
                    },
                  }),
                )
              }
              onText={(role) =>
                void persist(() =>
                  addText({
                    data: {
                      ...pid,
                      role,
                      slice: span?.start ?? 0,
                      collectionId: activeCollection.id,
                    },
                  }),
                )
              }
              onShape={(shape) => void createOverlay("shape", undefined, undefined, shape)}
              onImage={(file, shape) => void importImage(file, "overlay", shape)}
              onLine={(smooth) => void createLine(smooth)}
            />
          </aside>
        ) : (
          <button
            type="button"
            className="flex w-9 shrink-0 items-start justify-center border-r border-border bg-popover pt-3 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-primary"
            title={`Show library (${leftHint})`}
            aria-label={`Show library (${leftHint})`}
            onClick={() => setLeftOpen(true)}
          >
            <span className="grid size-7 place-items-center rounded-md">
              <PanelLeft className="size-4" />
            </span>
          </button>
        )}
        <main className="canvas-grid min-h-0 min-w-0 flex-1 overflow-hidden">
          <CanvasHost
            board={board}
            nodes={nodes}
            assets={assets}
            selectedId={selectedId}
            onSelect={selectCanvas}
            onMove={(id, x, y) => void commitNode(id, { x, y }, "Move", "move")}
            onMoveCollection={(id, x, y) => void moveCollection(id, x, y)}
            onTransform={(id, next) => void commitNode(id, next, "Transform", "transform")}
            duplicateHint={duplicateHint}
            onDuplicateNode={(id) => void duplicateSelectedNode(id)}
            onRemoveNode={(id) => void removeSelected(id)}
            onDuplicateSlice={() => void duplicateSelectedSlice()}
            onDeleteSlice={() => void deleteSelectedSlice()}
            onDuplicateCollection={(id) => void cloneCurrent(undefined, id)}
            onRemoveCollection={(id) => void deleteCurrentStrip(id)}
            onPatchNode={(id, patch, label) => void commitNode(id, patch, label)}
            onBringToFront={(id) => stackNode(id, "front")}
            onSendToBack={(id) => stackNode(id, "back")}
          />
        </main>
        {rightOpen ? (
          <aside className="flex w-74 shrink-0 flex-col overflow-hidden border-l border-border bg-linear-to-b from-popover to-background/95">
            <header className="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border/70 bg-background/25 px-2.5">
              <span className="flex items-center gap-2 px-1 text-xs font-semibold tracking-widest text-foreground/90 uppercase">
                <SlidersHorizontal className="size-3.5 text-primary" aria-hidden />
                Inspector
              </span>
              <div className="flex items-center">
                <HistoryDrawer
                  events={events}
                  total={total}
                  onRestore={(seq) => void restoreToEvent(seq)}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={`Hide inspector (${rightHint})`}
                  aria-label={`Hide inspector (${rightHint})`}
                  onClick={() => setRightOpen(false)}
                >
                  <PanelRightClose />
                </Button>
              </div>
            </header>
            <Inspector
              node={selected}
              board={{
                ...collectionAsBoard(board, activeCollection),
                name: stripDraft,
              }}
              boardSelected={boardSelected}
              span={span}
              assets={assets}
              onPatch={(id, patch, label, kind) => void commitNode(id, patch, label, kind)}
              onRemove={(id) => void removeSelected(id)}
              onBoardName={queueStripName}
              onBoardFill={(color, imageId) => void commitBoardFill(color, imageId)}
              onSliceFill={(color, imageId) => void commitSliceFill(color, imageId)}
              onSliceSpan={(index) => void commitSliceSpan(index)}
              onResetSlice={() => void resetSlice()}
              onDeleteSlice={() => void deleteSelectedSlice()}
              onDuplicateSlice={() => void duplicateSelectedSlice()}
              onDuplicateNode={(id) => void duplicateSelectedNode(id)}
              duplicateHint={duplicateHint}
              onStack={(where) => {
                if (selected !== null) stackNode(selected.id, where);
              }}
              onImport={(file, apply) => void importImage(file, apply)}
              onApplyStore={(store) => void applyStoreRules(store)}
            />
          </aside>
        ) : (
          <button
            type="button"
            className="flex w-9 shrink-0 items-start justify-center border-l border-border bg-popover pt-3 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-primary"
            title={`Show inspector (${rightHint})`}
            aria-label={`Show inspector (${rightHint})`}
            onClick={() => setRightOpen(true)}
          >
            <span className="grid size-7 place-items-center rounded-md">
              <PanelRight className="size-4" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
