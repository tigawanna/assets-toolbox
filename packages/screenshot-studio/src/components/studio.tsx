import { count } from "@tanstack/db";
import { HotkeysProvider, useHotkeys, useFormatForDisplay } from "@tanstack/react-hotkeys";
import { useLiveQuery } from "@tanstack/react-db";
import { Link } from "@tanstack/react-router";
import {
  BookmarkPlus,
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
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { downloadSnapshotsZip } from "@/canvas/export-slices";
import { CanvasHost } from "@/canvas/canvas-host";
import { completeDesktopFlush, onDesktopFlush, type DesktopFlush } from "@/desktop/runtime";
import { ScreenshotStudioIcon } from "@/components/brand-icon";
import { BoardCloneMenu } from "@/components/board-clone-menu";
import { StudioSheet } from "@/components/studio-sheet";
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
  applySnapshot,
  assetsCollection,
  clearStudio,
  mergeSnapshot,
  boardCollection,
  dropNode,
  eventsCollection,
  nodesCollection,
  pruneNodes,
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
  renameBoard,
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

export type StudioProps = {
  projectId: string;
  onReady?: (flush: DesktopFlush | null) => void;
  onHome?: () => void;
  onSaveTemplate?: (name: string) => Promise<void> | void;
  templatesPanel?: ReactNode;
  reloadKey?: number;
  embedded?: boolean;
};

export function Studio({
  projectId,
  onReady,
  onHome,
  onSaveTemplate,
  templatesPanel,
  reloadKey,
  embedded = false,
}: StudioProps) {
  return (
    <HotkeysProvider>
      <StudioShell
        projectId={projectId}
        onReady={onReady}
        onHome={onHome}
        onSaveTemplate={onSaveTemplate}
        templatesPanel={templatesPanel}
        reloadKey={reloadKey}
        embedded={embedded}
      />
    </HotkeysProvider>
  );
}

function StudioShell({
  projectId,
  onReady,
  onHome,
  onSaveTemplate,
  templatesPanel,
  reloadKey,
  embedded,
}: {
  projectId: string;
  onReady?: (flush: DesktopFlush | null) => void;
  onHome?: () => void;
  onSaveTemplate?: (name: string) => Promise<void> | void;
  templatesPanel?: ReactNode;
  reloadKey?: number;
  embedded: boolean;
}) {
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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);
  const hydrated = hydratedProjectId === projectId;
  const undoRef = useRef<() => void>(() => {});
  const undoing = useRef(false);
  const projectIdRef = useRef(projectId);
  const projectGeneration = useRef(0);
  if (projectIdRef.current !== projectId) {
    projectIdRef.current = projectId;
    projectGeneration.current += 1;
  }
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingOperations = useRef(0);
  const idleWaiters = useRef<Array<() => void>>([]);
  const mutationFailed = useRef(false);
  const nameRevision = useRef(0);
  const stripRevision = useRef(0);
  const nameEditing = useRef(false);
  const stripEditing = useRef(false);
  const nameBaseline = useRef("");
  const stripBaseline = useRef("");
  const skipNameBlur = useRef(false);
  const skipStripBlur = useRef(false);
  const formatHotkey = useFormatForDisplay();
  const leftHint = formatHotkey(embedded ? "[" : "Mod+B");
  const rightHint = formatHotkey(embedded ? "]" : "Mod+L");
  const duplicateHint = formatHotkey("Mod+D");
  const undoHint = formatHotkey("Mod+Z");
  const presets = listPresets();
  const pid = { projectId };
  const board = boardQuery.data[0] ?? defaultBoard();
  const nodes = nodeQuery.data ?? [];
  const assets = assetQuery.data ?? [];
  const activeCollection = selectionCollection(board, nodes, selectedId);
  const activeCollectionIdRef = useRef(activeCollection.id);
  const stripDraftCollectionIdRef = useRef(activeCollection.id);
  activeCollectionIdRef.current = activeCollection.id;
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

  function isProjectCurrent(generation: number): boolean {
    return projectGeneration.current === generation && projectIdRef.current === projectId;
  }

  function reportError(cause: unknown, fallback: string, generation: number) {
    if (!isProjectCurrent(generation)) return;
    setError(cause instanceof Error ? cause.message : fallback);
  }

  function serializeMutation<T>(generation: number, work: () => Promise<T>): Promise<T | null> {
    const run = mutationQueue.current.then(async () => {
      if (!isProjectCurrent(generation)) return null;
      return await work();
    });
    mutationQueue.current = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  function beginOperation(): () => void {
    pendingOperations.current += 1;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      pendingOperations.current -= 1;
      if (pendingOperations.current === 0) {
        const waiters = idleWaiters.current;
        idleWaiters.current = [];
        for (const resolve of waiters) resolve();
      }
    };
  }

  async function waitForOperations(): Promise<void> {
    while (pendingOperations.current > 0) {
      await new Promise<void>((resolve) => idleWaiters.current.push(resolve));
    }
  }

  const flush = useCallback<DesktopFlush>(async () => {
    await waitForOperations();
    await mutationQueue.current;
    return !mutationFailed.current;
  }, []);

  useEffect(() => {
    const unsubscribe = onDesktopFlush("studio", (requestId) => {
      void flush().then((succeeded) => completeDesktopFlush("studio", succeeded, requestId));
    });
    onReady?.(flush);
    return () => {
      unsubscribe?.();
      onReady?.(null);
    };
  }, [flush, onReady]);

  useHotkeys([
    { hotkey: embedded ? "[" : "Mod+B", callback: () => setLeftOpen((open) => !open) },
    { hotkey: embedded ? "]" : "Mod+L", callback: () => setRightOpen((open) => !open) },
    {
      hotkey: "Mod+D",
      callback: (event) => {
        event.preventDefault();
        if (!hydrated) return;
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
    return () => {
      projectGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const generation = projectGeneration.current;
    nameRevision.current = 0;
    stripRevision.current = 0;
    nameEditing.current = false;
    stripEditing.current = false;
    undoing.current = false;
    mutationFailed.current = false;
    setError("");
    setSelectedId(null);
    setBusy("");
    setReloading(false);
    setHydratedProjectId(null);
    void (async () => {
      try {
        await clearStudio();
        if (cancelled || !isProjectCurrent(generation)) return;
        const snapshot = await loadStudio({ data: { projectId } });
        if (cancelled || !isProjectCurrent(generation)) return;
        await applySnapshot(snapshot);
        if (!cancelled && isProjectCurrent(generation)) setHydratedProjectId(projectId);
      } catch (cause: unknown) {
        if (!cancelled) reportError(cause, "Could not load", generation);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const seqRef = useRef(0);
  seqRef.current = events[0]?.seq ?? total;

  useEffect(() => {
    if (embedded || !hydrated) return;
    const generation = projectGeneration.current;
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
      void loadStudio({ data: { projectId } }).then((snapshot) => {
        if (isProjectCurrent(generation)) return mergeSnapshot(snapshot);
      });
    };
    return () => source.close();
  }, [embedded, hydrated, projectId]);

  useEffect(() => {
    if (!nameEditing.current && nameRevision.current === 0) setNameDraft(board.name);
  }, [board.name]);

  useEffect(() => {
    if (stripDraftCollectionIdRef.current !== activeCollection.id) {
      stripDraftCollectionIdRef.current = activeCollection.id;
      stripRevision.current = 0;
      setStripDraft(activeCollection.name);
      return;
    }
    if (!stripEditing.current && stripRevision.current === 0) setStripDraft(activeCollection.name);
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

  async function persist<T extends StudioSnapshot>(work: () => Promise<T>): Promise<T | null> {
    const endOperation = beginOperation();
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) {
      endOperation();
      return null;
    }
    setError("");
    try {
      const snapshot = await serializeMutation(generation, async () => {
        const result = await work();
        if (!isProjectCurrent(generation)) return null;
        await mergeSnapshot(result);
        if (isProjectCurrent(generation)) mutationFailed.current = false;
        return isProjectCurrent(generation) ? result : null;
      });
      return snapshot;
    } catch (cause: unknown) {
      if (isProjectCurrent(generation)) mutationFailed.current = true;
      reportError(cause, "Could not save", generation);
      throw cause;
    } finally {
      endOperation();
    }
  }

  function save(work: () => Promise<StudioSnapshot>) {
    void persist(work).catch(() => {
      // persist has already reported the error for the active project.
    });
  }

  async function persistLive(
    work: () => Promise<StudioSnapshot>,
    live: (generation: number) => Promise<void>,
  ): Promise<StudioSnapshot | null> {
    const endOperation = beginOperation();
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) {
      endOperation();
      return null;
    }
    setError("");
    try {
      await live(generation);
      if (!isProjectCurrent(generation)) return null;
      return await serializeMutation(generation, async () => {
        const snapshot = await work();
        if (!isProjectCurrent(generation)) return null;
        await mergeSnapshot(snapshot);
        if (isProjectCurrent(generation)) mutationFailed.current = false;
        return isProjectCurrent(generation) ? snapshot : null;
      });
    } catch (cause: unknown) {
      if (isProjectCurrent(generation)) mutationFailed.current = true;
      reportError(cause, "Could not save", generation);
      return null;
    } finally {
      endOperation();
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
    if (!isProjectCurrent(projectGeneration.current)) return;
    const current = nodes.find((node) => node.id === id);
    if (current === undefined) return;
    const next = { ...current, ...patch, id: current.id, type: current.type } as StudioNode;
    await persistLive(
      () => patchNode({ data: { ...pid, id, patch, label, kind } }),
      () => replaceNode(next),
    );
  }

  async function removeSelected(id: string) {
    if (!isProjectCurrent(projectGeneration.current)) return;
    setSelectedId(null);
    await persistLive(
      () => removeNode({ data: { ...pid, id } }),
      () => dropNode(id),
    );
  }

  async function commitBoardName(raw: string, normalizeDraft = true) {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    const name = raw.trim() === "" ? "Untitled" : raw.trim();
    if (normalizeDraft) setNameDraft(name);
    const revision = ++nameRevision.current;
    try {
      const snapshot = await persist(async () => {
        const result: unknown = await renameBoard({ data: { ...pid, name } });
        // The browser adapter returns a snapshot; the canonical server returns a summary.
        if (result !== null && typeof result === "object" && "board" in result) {
          return result as StudioSnapshot;
        }
        return loadStudio({ data: pid });
      });
      if (snapshot === null || !isProjectCurrent(generation) || revision !== nameRevision.current) {
        return;
      }
      nameRevision.current = 0;
      if (!nameEditing.current) setNameDraft(snapshot.board.name);
    } catch (cause: unknown) {
      if (!isProjectCurrent(generation) || revision !== nameRevision.current) return;
      nameRevision.current = 0;
      if (!nameEditing.current) setNameDraft(board.name);
      reportError(cause, "Could not rename", generation);
    }
  }

  function queueBoardName(raw: string) {
    nameEditing.current = true;
    setNameDraft(raw);
    void commitBoardName(raw, false);
  }

  async function commitStripName(raw: string, normalizeDraft = true) {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    const collectionId = activeCollection.id;
    const name = raw.trim() === "" ? activeCollection.name : raw.trim();
    if (normalizeDraft) setStripDraft(name);
    const revision = ++stripRevision.current;
    try {
      // The browser adapter supports history-preserving collection renames. The
      // canonical server keeps its existing patchBoard API in standalone mode.
      const renameCollection = renameBoard as unknown as (options: {
        data: { projectId: string; name: string; collectionId: string };
      }) => Promise<StudioSnapshot>;
      const snapshot = embedded
        ? await persist(() => renameCollection({ data: { ...pid, collectionId, name } }))
        : await persist(() => patchBoard({ data: { ...pid, collectionId, name } }));
      if (
        snapshot === null ||
        !isProjectCurrent(generation) ||
        activeCollectionIdRef.current !== collectionId ||
        revision !== stripRevision.current
      ) {
        return;
      }
      stripRevision.current = 0;
      if (!stripEditing.current) {
        setStripDraft(
          snapshot.board.collections?.find((collection) => collection.id === collectionId)?.name ??
            name,
        );
      }
    } catch (cause: unknown) {
      if (
        !isProjectCurrent(generation) ||
        activeCollectionIdRef.current !== collectionId ||
        revision !== stripRevision.current
      ) {
        return;
      }
      stripRevision.current = 0;
      if (!stripEditing.current) setStripDraft(activeCollection.name);
      reportError(cause, "Could not rename strip", generation);
    }
  }

  function queueStripName(raw: string) {
    stripEditing.current = true;
    setStripDraft(raw);
    void commitStripName(raw, false);
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
    const generation = projectGeneration.current;
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
      if (snapshot === null || !isProjectCurrent(generation)) return;
      const addedId = snapshot.events.at(-1)?.nodeId;
      if (addedId !== undefined && addedId !== "") setSelectedId(addedId);
    } catch (cause: unknown) {
      reportError(cause, `Could not add ${kind}`, generation);
    }
  }

  async function createLine(smooth: boolean) {
    const generation = projectGeneration.current;
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
      if (snapshot === null || !isProjectCurrent(generation)) return;
      const addedId = snapshot.events.at(-1)?.nodeId;
      if (addedId !== undefined && addedId !== "") setSelectedId(addedId);
    } catch (cause: unknown) {
      reportError(cause, "Could not add line", generation);
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
    const generation = projectGeneration.current;
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
      reportError(cause, "Could not save", generation);
    }
  }

  async function commitBoardFill(color: string, imageId?: string) {
    await commitFill({ ...fill, color, imageId });
  }

  async function commitSliceFill(color: string, imageId?: string) {
    const generation = projectGeneration.current;
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
    if (isProjectCurrent(generation)) setSelectedId(bandSelectionId(band.id));
  }

  async function commitSliceSpan(index: number) {
    const generation = projectGeneration.current;
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
    if (isProjectCurrent(generation)) setSelectedId(bandSelectionId(band.id));
  }

  async function resetSlice() {
    const generation = projectGeneration.current;
    if (selectedBand === undefined) return;
    const start = selectedBand.start;
    await commitFill({ ...fill, bands: removeBand(fill.bands, selectedBand.id) });
    if (isProjectCurrent(generation)) setSelectedId(sliceSelectionId(activeCollection.id, start));
  }

  async function deleteSelectedSlice() {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation) || span === null) return;
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
      reportError(cause, "Could not delete slice", generation);
    }
  }

  async function duplicateSelectedSlice() {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation) || span === null) return;
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
      if (isProjectCurrent(generation)) {
        setSelectedId(sliceSelectionId(activeCollection.id, copyStart));
      }
    } catch (cause: unknown) {
      reportError(cause, "Could not duplicate slice", generation);
    }
  }

  async function duplicateSelectedNode(id: string) {
    const generation = projectGeneration.current;
    try {
      const snapshot = await persist(() => cloneSelectedNode({ data: { ...pid, id } }));
      if (snapshot === null || !isProjectCurrent(generation) || snapshot.nodeId === undefined) {
        return;
      }
      setSelectedId(snapshot.nodeId);
    } catch (cause: unknown) {
      reportError(cause, "Could not duplicate", generation);
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
      async (generation) => {
        for (const node of nodes) {
          if (!isProjectCurrent(generation)) return;
          const index = ids.indexOf(node.id);
          if (index < 0) continue;
          await replaceNode({ ...node, z: count - 1 - index });
        }
      },
    );
  }

  async function undoLast() {
    const generation = projectGeneration.current;
    if (!hydrated || !isProjectCurrent(generation) || total < 1 || undoing.current) return;
    undoing.current = true;
    setError("");
    try {
      const snapshot = await serializeMutation(generation, async () => {
        const next = await undoEvent({ data: pid });
        if (!isProjectCurrent(generation)) return null;
        await applySnapshot(next);
        return next;
      });
      if (snapshot !== null && isProjectCurrent(generation)) setSelectedId(null);
    } catch (cause: unknown) {
      if (isProjectCurrent(generation)) mutationFailed.current = true;
      reportError(cause, "Could not undo", generation);
    } finally {
      undoing.current = false;
    }
  }
  undoRef.current = () => {
    void undoLast();
  };

  async function restoreToEvent(seq: number) {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    setError("");
    try {
      const snapshot = await serializeMutation(generation, async () => {
        const next = await restoreHistory({ data: { ...pid, seq } });
        if (!isProjectCurrent(generation)) return null;
        await applySnapshot(next);
        return next;
      });
      if (snapshot !== null && isProjectCurrent(generation)) setSelectedId(null);
    } catch (cause: unknown) {
      if (isProjectCurrent(generation)) mutationFailed.current = true;
      reportError(cause, "Could not restore", generation);
    }
  }

  async function reloadLatest() {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    setReloading(true);
    setError("");
    try {
      await serializeMutation(generation, async () => {
        const snapshot = await loadStudio({ data: pid });
        if (!isProjectCurrent(generation)) return;
        await applySnapshot(snapshot);
      });
    } catch (cause: unknown) {
      if (isProjectCurrent(generation)) mutationFailed.current = true;
      reportError(cause, "Could not reload", generation);
    } finally {
      if (isProjectCurrent(generation)) setReloading(false);
    }
  }

  async function cloneCurrent(store?: StoreName, collectionId = activeCollection.id) {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    markBusy("clone");
    setError("");
    try {
      const snapshot = await persist(() =>
        cloneCollection({
          data: { ...pid, collectionId, store },
        }),
      );
      if (snapshot === null || !isProjectCurrent(generation)) return;
      const added = boardCollections(snapshot.board).at(-1);
      if (added !== undefined) setSelectedId(collectionSelectionId(added.id));
    } catch (cause: unknown) {
      reportError(cause, "Could not clone", generation);
    } finally {
      if (isProjectCurrent(generation)) setBusy("");
    }
  }

  async function deleteCurrentStrip(collectionId: string) {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    markBusy("delete-strip");
    setError("");
    const next = removeSceneCollection(board, nodes, collectionId);
    const remaining = boardCollections(next.board)[0];
    setSelectedId(remaining === undefined ? null : collectionSelectionId(remaining.id));
    try {
      await persistLive(
        () => removeCollection({ data: { ...pid, collectionId } }),
        async (liveGeneration) => {
          await replaceBoard(next.board);
          if (!isProjectCurrent(liveGeneration)) return;
          await pruneNodes(new Set(next.nodes.map((node) => node.id)));
        },
      );
    } catch (cause: unknown) {
      reportError(cause, "Could not delete strip", generation);
    } finally {
      if (isProjectCurrent(generation)) setBusy("");
    }
  }

  async function applyStoreRules(store: StoreName) {
    const generation = projectGeneration.current;
    try {
      await persist(() =>
        applyStore({ data: { ...pid, store, collectionId: activeCollection.id } }),
      );
    } catch (cause: unknown) {
      reportError(cause, "Could not apply store rules", generation);
    }
  }

  async function exportCollection() {
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    markBusy("export");
    setError("");
    try {
      await downloadSnapshotsZip([{ board, nodes, events, assets }], `${fileSlug(board.name)}.zip`);
    } catch (cause: unknown) {
      reportError(cause, "Could not export", generation);
    } finally {
      if (isProjectCurrent(generation)) setBusy("");
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
    const generation = projectGeneration.current;
    if (!isProjectCurrent(generation)) return;
    const endOperation = beginOperation();
    try {
      const data = await readImageFile(file);
      if (!isProjectCurrent(generation)) return;
      const snapshot = await persist(() =>
        addAsset({
          data: { ...pid, name: file.name, mime: file.type || "image/png", data },
        }),
      );
      if (snapshot === null || !isProjectCurrent(generation)) return;
      const assetId = snapshot.assetId;
      if (assetId === undefined) return;
      if (apply === "board") {
        await commitBoardFill(fill.color, assetId);
        if (!isProjectCurrent(generation)) return;
      }
      if (apply === "band") {
        await commitSliceFill(span?.color ?? fill.color, assetId);
        if (!isProjectCurrent(generation)) return;
      }
      if (apply === "device" && selected !== null && selected.type === "device") {
        await commitNode(selected.id, { screenAssetId: assetId }, "Screen image");
        if (!isProjectCurrent(generation)) return;
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
      reportError(cause, "Could not import", generation);
    } finally {
      endOperation();
    }
  }

  const exportLabel = busy === "export" ? "Exporting" : "Export";
  const reloadLabel = reloading ? "Reloading" : "Reload";

  if (!hydrated) {
    return (
      <div
        className={`grid ${embedded ? "screenshot-studio-root h-full" : "h-screen"} place-items-center bg-background text-sm text-muted-foreground`}
      >
        {error === "" ? "Opening board…" : error}
      </div>
    );
  }

  return (
    <div
      className={`flex ${embedded ? "h-full" : "h-screen"} min-h-0 flex-col overflow-hidden bg-background text-foreground${embedded ? " screenshot-studio-root" : ""}`}
    >
      <header className="no-scrollbar flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-2">
        {onHome ? (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            title="Screenshot Studio boards"
            aria-label="Screenshot Studio boards"
            onClick={onHome}
          >
            <ScreenshotStudioIcon className="size-5" />
            <span>Boards</span>
          </button>
        ) : (
          <Link
            to="/"
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            title="Screenshot Studio boards"
            aria-label="Screenshot Studio boards"
          >
            <ScreenshotStudioIcon className="size-5" />
            <span>Boards</span>
          </Link>
        )}
        <Input
          aria-label="Board name"
          value={nameDraft}
          onChange={(event) => queueBoardName(event.target.value)}
          onFocus={() => {
            nameEditing.current = true;
            nameBaseline.current = board.name;
          }}
          onBlur={(event) => {
            nameEditing.current = false;
            if (skipNameBlur.current) {
              skipNameBlur.current = false;
              return;
            }
            void commitBoardName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              nameEditing.current = false;
              void commitBoardName(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              nameEditing.current = false;
              skipNameBlur.current = true;
              event.currentTarget.blur();
              void commitBoardName(nameBaseline.current);
            }
          }}
          className="h-7 w-28 min-w-0 border-transparent bg-transparent px-1.5 text-xs tracking-tight shadow-none hover:border-border focus-visible:border-ring"
        />
        <Input
          aria-label="Scene strip name"
          data-testid="header-strip-name"
          value={stripDraft}
          onChange={(event) => queueStripName(event.target.value)}
          onFocus={() => {
            stripEditing.current = true;
            stripBaseline.current = activeCollection.name;
          }}
          onBlur={(event) => {
            stripEditing.current = false;
            if (skipStripBlur.current) {
              skipStripBlur.current = false;
              return;
            }
            void commitStripName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              stripEditing.current = false;
              void commitStripName(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              stripEditing.current = false;
              skipStripBlur.current = true;
              event.currentTarget.blur();
              void commitStripName(stripBaseline.current);
            }
          }}
          className="h-7 w-24 min-w-0 border-transparent bg-transparent px-1.5 text-xs tracking-tight shadow-none hover:border-border focus-visible:border-ring"
        />
        <select
          aria-label="Scene size"
          className="h-7 w-32 min-w-0 rounded-md border border-border bg-popover px-1.5 text-xs"
          value={`${activeCollection.store}:${activeCollection.presetId}`}
          onChange={(event) => {
            const raw = event.target.value;
            const sep = raw.indexOf(":");
            const store = raw.slice(0, sep) as "play" | "app-store";
            const presetId = raw.slice(sep + 1);
            save(() =>
              patchBoard({
                data: { ...pid, collectionId: activeCollection.id, store, presetId },
              }),
            );
          }}
        >
          <optgroup label="Google Play">
            {playPresets.map((preset) => (
              <option key={`play:${preset.id}`} value={`play:${preset.id}`}>
                {embedded ? preset.label : `${preset.label} · ${preset.width}×${preset.height}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="App Store">
            {appPresets.map((preset) => (
              <option key={`app-store:${preset.id}`} value={`app-store:${preset.id}`}>
                {embedded ? preset.label : `${preset.label} · ${preset.width}×${preset.height}`}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="flex shrink-0 items-center gap-0.5 text-xs">
          <Button
            variant="outline"
            size="xs"
            title="Remove the last slice"
            disabled={activeCollection.sliceCount <= 1}
            onClick={() =>
              save(() =>
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
          <span className="min-w-12 text-center text-xs text-muted-foreground">
            {activeCollection.sliceCount} slices
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              save(() =>
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
        {onSaveTemplate ? (
          <div className="relative">
            <Button
              variant="ghost"
              size={embedded ? "icon-xs" : "xs"}
              title="Save this board as a reusable template"
              aria-label="Save board as template"
              onClick={() => setTemplateOpen((open) => !open)}
            >
              <BookmarkPlus />
              {embedded ? null : "Template"}
            </Button>
            {templateOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-2 shadow-md">
                <input
                  autoFocus
                  aria-label="Board template name"
                  value={templateName}
                  placeholder="Template name"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none"
                  onChange={(event) => setTemplateName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setTemplateOpen(false);
                  }}
                />
                <div className="mt-2 flex justify-end gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setTemplateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    disabled={!templateName.trim()}
                    onClick={() => {
                      void Promise.resolve(onSaveTemplate?.(templateName.trim())).finally(() => {
                        setTemplateOpen(false);
                        setTemplateName("");
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {templatesPanel ? (
          <StudioSheet
            title="Board templates"
            description="Saved layouts you can apply to this or any other project."
            side="right"
            trigger={
              <Button
                variant="ghost"
                size={embedded ? "icon-xs" : "xs"}
                title="Browse saved board templates"
                aria-label="Browse board templates"
              >
                <Library />
                {embedded ? null : "Templates"}
              </Button>
            }
          >
            {templatesPanel}
          </StudioSheet>
        ) : null}
        <Button
          variant="ghost"
          size={embedded ? "icon-xs" : "xs"}
          data-testid="export-board"
          disabled={busy !== ""}
          title="Download every scene strip on this board as PNGs"
          aria-label="Export board"
          onClick={() => void exportCollection()}
        >
          <Download />
          {embedded ? null : exportLabel}
        </Button>
        <Button
          variant="ghost"
          size={embedded ? "icon-xs" : "xs"}
          className="ml-auto"
          data-testid="recenter-board"
          title="Fit every scene strip in the view (0)"
          aria-label="Recenter board"
          onClick={() => window.dispatchEvent(new Event(FIT_CAMERA_EVENT))}
        >
          <LocateFixed />
          {embedded ? null : "Recenter"}
        </Button>
        <Button
          variant="ghost"
          size={embedded ? "icon-xs" : "xs"}
          title={`Undo last change (${undoHint})`}
          aria-label="Undo last change"
          disabled={total < 1}
          onClick={() => void undoLast()}
        >
          <Undo2 />
          {embedded ? null : "Undo"}
        </Button>
        <Button
          variant="ghost"
          size={embedded ? "icon-xs" : "xs"}
          title="Reload the saved board if the canvas looks stale"
          aria-label="Reload saved board"
          disabled={reloading}
          onClick={() => void reloadLatest()}
        >
          <RotateCw className={reloading ? "animate-spin" : undefined} />
          {embedded ? null : reloadLabel}
        </Button>
        {embedded ? null : <ThemeToggle />}
        <SettingsDrawer projectId={projectId} align="header" embedded={embedded} />
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
          <aside
            className={`flex ${embedded ? "w-60" : "w-66"} shrink-0 flex-col overflow-hidden border-r border-border ${embedded ? "bg-popover" : "bg-linear-to-b from-popover to-background/95"}`}
          >
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
            <div
              className={
                embedded ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : "contents"
              }
            >
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
                  save(() =>
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
                  save(() =>
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
                  save(() =>
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
            </div>
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
          <aside
            className={`flex ${embedded ? "w-64" : "w-74"} shrink-0 flex-col overflow-hidden border-l border-border ${embedded ? "bg-popover" : "bg-linear-to-b from-popover to-background/95"}`}
          >
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
