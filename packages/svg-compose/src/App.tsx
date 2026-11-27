import { useCallback, useEffect, useRef, useState } from "react";

import {
  Stage,
  type LayerNode,
  type SelectionStyle,
  type StageSnapshot,
  type StageViewport,
} from "./canvas/stage";
import { ActionButton } from "./components/action-button";
import { Inspector } from "./components/inspector";
import { Layers } from "./components/layers";
import { ShortcutsDialog, isShortcutHelp } from "./components/shortcuts";
import { StatusHud, type DragStatus, type Notice } from "./components/status-hud";
import { ToolRail } from "./components/tool-rail";
import { completeDesktopFlush, getWorkspaceId, onDesktopFlush } from "./lib/desktop";
import {
  documentKey,
  loadWorkspaceFromLocal,
  loadWorkspaceFromServer,
  newestWorkspace,
  saveWorkspaceToLocal,
  saveWorkspaceToServer,
} from "./lib/persistence";
import {
  AlignBottomIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  AlignMiddleIcon,
  AlignRightIcon,
  AlignTopIcon,
  BackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExportIcon,
  FitIcon,
  FocusIcon,
  HelpIcon,
  ImageIcon,
  ImportIcon,
  LogoIcon,
  RecenterIcon,
  RedoIcon,
  UndoIcon,
  DetachIcon,
  DownIcon,
  FrontIcon,
  GroupIcon,
  NodeIcon,
  TrashIcon,
  UngroupIcon,
  UpIcon,
} from "./components/icons";
import { createSaveQueue } from "./lib/save-queue";
import { toolById } from "./tools/shapes";

type SaveState = "loading" | "saving" | "saved" | "backup" | "error" | "empty";
type Flush = () => Promise<boolean>;

export type AppProps = {
  onReady?: (flush: Flush | null) => void;
  onHome?: () => void;
  embedded?: boolean;
};

const SAVE_LABELS: Record<SaveState, string> = {
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved locally",
  backup: "Browser backup",
  error: "Save failed",
  empty: "Autosave ready",
};

export default function App({ onReady, onHome, embedded = false }: AppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const noticeId = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const hydrationBaselineRef = useRef("");
  const editedDuringHydrationRef = useRef(false);
  const lastDocumentKeyRef = useRef("");
  const pendingSaveRef = useRef<{ name: string; svg: string; viewport: StageViewport } | null>(
    null,
  );
  const saveTimerRef = useRef<number | null>(null);
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef(createSaveQueue());
  const workspaceIdRef = useRef("");

  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [drag, setDrag] = useState<DragStatus | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tree, setTree] = useState<LayerNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [enteredGroupId, setEnteredGroupId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toolId, setToolId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [railExpanded, setRailExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const [style, setStyle] = useState<SelectionStyle | null>(null);

  const notify = useCallback((label: string, keyHint?: string, detail?: string) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, label, keyHint, detail });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1900);
  }, []);

  const persistNow = useCallback((): Promise<boolean> => {
    const pending = pendingSaveRef.current;
    if (!pending) return Promise.resolve(true);
    const revision = saveRevisionRef.current;
    const workspaceId = workspaceIdRef.current;
    const localSaved = saveWorkspaceToLocal(pending, { workspaceId }) !== null;
    setSaveState("saving");

    const run = async (): Promise<boolean> => {
      try {
        const saved = await saveWorkspaceToServer(pending);
        if (revision === saveRevisionRef.current) {
          saveWorkspaceToLocal(saved, { workspaceId, updatedAt: saved.updatedAt });
          pendingSaveRef.current = null;
          setLastSavedAt(saved.updatedAt);
          setSaveState("saved");
        }
        return true;
      } catch {
        if (revision === saveRevisionRef.current) {
          setSaveState(localSaved ? "backup" : "error");
        }
        return localSaved;
      }
    };

    return saveQueueRef.current(run);
  }, []);

  useEffect(() => {
    const unsubscribe = onDesktopFlush((requestId) => {
      void persistNow().then((succeeded) => completeDesktopFlush(succeeded, requestId));
    });
    onReady?.(persistNow);
    return () => {
      unsubscribe?.();
      onReady?.(null);
    };
  }, [onReady, persistNow]);

  const queueSave = useCallback(
    (snapshot: StageSnapshot) => {
      saveRevisionRef.current += 1;
      pendingSaveRef.current = {
        name: "Untitled",
        svg: snapshot.svg,
        viewport: snapshot.viewport,
      };
      setSaveState("saving");
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => void persistNow(), 900);
    },
    [persistNow],
  );

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = new Stage(container);
    stageRef.current = stage;
    hydrationBaselineRef.current = documentKey(stage.snapshot());
    editedDuringHydrationRef.current = false;
    let restoring = false;
    const sync = () => {
      setZoom(stage.zoomLevel);
      setCanUndo(stage.canUndo);
      setCanRedo(stage.canRedo);
      setDrag(stage.dragState);
      setStyle(stage.getSelectionStyle());
      setTree(stage.getTree());
      setSelectedIds(stage.selectedIds);
      setEnteredGroupId(stage.enteredGroupId);
      if (!hydratedRef.current) {
        if (!restoring && documentKey(stage.snapshot()) !== hydrationBaselineRef.current) {
          editedDuringHydrationRef.current = true;
        }
        return;
      }
      const snapshot = stage.snapshot();
      const key = documentKey(snapshot);
      if (key !== lastDocumentKeyRef.current) {
        lastDocumentKeyRef.current = key;
        queueSave(snapshot);
      }
    };
    const unsubscribe = stage.subscribe(sync);
    sync();

    let cancelled = false;
    const restore = async () => {
      setSaveState("loading");
      const workspaceId = await getWorkspaceId();
      if (cancelled) return;
      workspaceIdRef.current = workspaceId;
      const [server, local] = await Promise.all([
        loadWorkspaceFromServer().catch(() => null),
        Promise.resolve(loadWorkspaceFromLocal(workspaceId)),
      ]);
      if (cancelled) return;
      const saved = newestWorkspace(server, local);
      const localWon =
        saved !== null &&
        saved === local &&
        (server === null || Date.parse(local.updatedAt) > Date.parse(server.updatedAt));
      const editedDuringHydration = editedDuringHydrationRef.current;
      if (saved && !editedDuringHydration) {
        restoring = true;
        try {
          stage.loadSnapshot({ svg: saved.svg, viewport: saved.viewport });
        } finally {
          restoring = false;
        }
        saveWorkspaceToLocal(saved, { workspaceId, updatedAt: saved.updatedAt });
        setLastSavedAt(saved.updatedAt);
        notify("Restored saved work");
      }
      lastDocumentKeyRef.current = documentKey(stage.snapshot());
      hydratedRef.current = true;
      pendingSaveRef.current = null;
      if (editedDuringHydration) {
        const snapshot = stage.snapshot();
        pendingSaveRef.current = {
          name: "Untitled",
          svg: snapshot.svg,
          viewport: snapshot.viewport,
        };
        setSaveState("saving");
        void persistNow();
      } else if (!saved) setSaveState("empty");
      else if (localWon) {
        pendingSaveRef.current = {
          name: saved.name,
          svg: saved.svg,
          viewport: saved.viewport,
        };
        setSaveState("saving");
        void persistNow();
      } else setSaveState(server ? "saved" : "error");
    };
    void restore();

    const flush = () => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      saveWorkspaceToLocal(pending, { workspaceId: workspaceIdRef.current });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/workspace",
          new Blob([JSON.stringify(pending)], { type: "application/json" }),
        );
      }
    };
    const onVisibility = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      unsubscribe();
      stage.destroy();
      stageRef.current = null;
      hydratedRef.current = false;
      hydrationBaselineRef.current = "";
      editedDuringHydrationRef.current = false;
    };
  }, [notify, queueSave]);

  useEffect(() => {
    stageRef.current?.setTool(toolById(toolId));
  }, [toolId]);

  const chooseTool = useCallback(
    (id: string | null, keyHint?: string) => {
      setToolId(id);
      const label = id ? (toolById(id)?.label ?? id) : "Select";
      notify(`${label} tool`, keyHint);
    },
    [notify],
  );

  const focusMode = !railExpanded && !rightExpanded;
  const toggleFocus = useCallback(() => {
    if (focusMode) {
      setRailExpanded(true);
      setRightExpanded(true);
      notify("Panels restored", "\\");
    } else {
      setRailExpanded(false);
      setRightExpanded(false);
      notify("Focus mode", "\\");
    }
  }, [focusMode, notify]);

  const importFiles = useCallback(
    async (files: File[]) => {
      const stage = stageRef.current;
      if (!stage) return;
      for (const file of files) {
        if (!(file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"))) {
          continue;
        }
        try {
          stage.importSvg(await file.text(), file.name.replace(/\.svg$/i, ""));
          notify(`Imported ${file.name}`);
          setError(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not import that file");
        }
      }
    },
    [notify],
  );

  const exportPng = useCallback(() => {
    const stage = stageRef.current;
    const data = stage?.exportPng(2);
    if (!data) {
      setError("PNG export needs a document with content");
      return;
    }
    const link = document.createElement("a");
    link.href = data;
    link.download = "compose.png";
    link.click();
    notify("Exported PNG");
  }, [notify]);

  // Paste SVG markup straight from the clipboard.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim().startsWith("<")) return;
      const stage = stageRef.current;
      if (!stage) return;
      try {
        stage.importSvg(text, "pasted");
        notify("Pasted SVG");
        setError(null);
      } catch {
        /* not SVG markup — ignore */
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [notify]);

  // Hotkeys (skipped while typing in a field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (isShortcutHelp(event)) {
        event.preventDefault();
        setShowShortcuts((open) => !open);
        notify("Keyboard shortcuts", "⇧?");
        return;
      }
      const stage = stageRef.current;
      if (!stage) return;
      const meta = event.ctrlKey || event.metaKey;
      if (
        !meta &&
        !event.altKey &&
        event.key.toLowerCase() === "s" &&
        stage.activeToolId !== "node"
      ) {
        notify("Drag a corner box to scale · Shift keeps proportions", "S");
        return;
      }
      if (!meta && !event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        stage.recenter();
        notify("Recenter view", "C");
        return;
      }
      if (!meta && !event.altKey) {
        if (event.key === "[") {
          setRailExpanded((value) => !value);
          notify("Tool rail", "[");
          return;
        }
        if (event.key === "]") {
          setRightExpanded((value) => !value);
          notify("Inspector panel", "]");
          return;
        }
        if (event.key === "\\") {
          toggleFocus();
          return;
        }
      }
      if (!meta && !event.altKey) {
        const keys: Record<string, string | null> = {
          v: null,
          r: "rect",
          e: "ellipse",
          l: "line",
          p: "pen",
          n: "node",
          t: "text",
          k: "corner",
          o: "rotate",
        };
        const next = keys[event.key.toLowerCase()];
        if (next !== undefined) {
          chooseTool(next, event.key.toUpperCase());
          return;
        }
      }
      if (!embedded && meta && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setRailExpanded((value) => !value);
        notify("Tool rail", "Ctrl B");
        return;
      }
      if (event.key === "Escape") {
        if (stage.activeToolId) chooseTool(null);
        else setToolId(null);
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        stage.convertSelectionToPath();
        notify("Object to Path", "⌘⇧C");
        return;
      }
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          stage.redo();
          notify("Redo", "⌘⇧Z");
        } else {
          stage.undo();
          notify("Undo", "⌘Z");
        }
      } else if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        stage.redo();
        notify("Redo", "⌘Y");
      } else if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        stage.duplicateSelection();
        notify("Duplicated", "⌘D");
      } else if (meta && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          stage.ungroupSelection();
          notify("Ungrouped", "⌘⇧G");
        } else if (stage.selectedIds.length < 2) {
          notify("Select 2+ objects to group", "⌘G");
        } else {
          stage.groupSelection();
          notify("Grouped", "⌘G");
        }
      } else if (event.key === "0" && meta) {
        event.preventDefault();
        stage.fitToDocument();
        notify("Fit to view", "⌘0");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseTool, embedded, notify, toggleFocus]);

  const activeTool = toolId ? (toolById(toolId)?.label ?? toolId) : null;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className={embedded ? "app svg-compose-root" : "app"}>
      {embedded ? (
        <header data-svg-editor-header>
          <div data-svg-header-brand>
            {onHome ? (
              <button
                type="button"
                className="button"
                data-svg-icon-button
                aria-label="Back to library"
                title="Back to library"
                onClick={onHome}
              >
                <LogoIcon />
              </button>
            ) : (
              <span data-svg-header-mark>
                <LogoIcon />
              </span>
            )}
            <div data-svg-header-title>
              <strong>Icon Compose</strong>
              <span>
                Untitled · {Math.round(zoom * 100)}% · {SAVE_LABELS[saveState]}
              </span>
            </div>
          </div>

          <div data-svg-header-actions>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Undo"
              title="Undo · ⌘Z"
              disabled={!canUndo}
              onClick={() => {
                stageRef.current?.undo();
                notify("Undo", "⌘Z");
              }}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Redo"
              title="Redo · ⌘⇧Z"
              disabled={!canRedo}
              onClick={() => {
                stageRef.current?.redo();
                notify("Redo", "⌘⇧Z");
              }}
            >
              <RedoIcon />
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Fit view"
              title="Fit view · ⌘0"
              onClick={() => {
                stageRef.current?.fitToDocument();
                notify("Fit to view", "⌘0");
              }}
            >
              <FitIcon />
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Recenter"
              title="Recenter · C"
              onClick={() => {
                stageRef.current?.recenter();
                notify("Recenter view", "C");
              }}
            >
              <RecenterIcon />
            </button>
            <label
              className="button"
              data-svg-icon-button
              aria-label="Import SVG"
              title="Import SVG"
            >
              <ImportIcon />
              <input
                type="file"
                accept=".svg,image/svg+xml"
                multiple
                onChange={(event) => {
                  void importFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={!hasSelection}
              onClick={() => {
                stageRef.current?.duplicateSelection();
                notify("Duplicated", "⌘D");
              }}
            >
              <CopyIcon />
              <span>Copy</span>
            </button>
            <button
              type="button"
              className="button"
              data-svg-primary
              onClick={() => {
                stageRef.current?.downloadSvg("compose");
                notify("Exported SVG");
              }}
            >
              <ExportIcon />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Download PNG"
              title="Download PNG"
              onClick={exportPng}
            >
              <ImageIcon />
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Focus mode"
              aria-pressed={focusMode}
              title="Focus mode · \\"
              onClick={toggleFocus}
            >
              <FocusIcon />
            </button>
            <button
              type="button"
              className="button"
              data-svg-icon-button
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts · ⇧?"
              onClick={() => setShowShortcuts(true)}
            >
              <HelpIcon />
            </button>
          </div>
        </header>
      ) : null}

      <main className="workspace">
        <ToolRail
          tool={toolId}
          onTool={(id) => chooseTool(id)}
          expanded={railExpanded}
          onToggleExpanded={() => setRailExpanded((value) => !value)}
          canUndo={canUndo}
          canRedo={canRedo}
          onImportFiles={(files) => void importFiles(files)}
          onUndo={() => {
            stageRef.current?.undo();
            notify("Undo", "⌘Z");
          }}
          onRedo={() => {
            stageRef.current?.redo();
            notify("Redo", "⌘⇧Z");
          }}
          onFit={() => {
            stageRef.current?.fitToDocument();
            notify("Fit to view", "⌘0");
          }}
          onRecenter={() => {
            stageRef.current?.recenter();
            notify("Recenter view", "C");
          }}
          onExportSvg={() => {
            stageRef.current?.downloadSvg("compose");
            notify("Exported SVG");
          }}
          onExportPng={exportPng}
          onShortcuts={() => setShowShortcuts(true)}
          focusMode={focusMode}
          onToggleFocus={toggleFocus}
          onScaleHint={() => notify("Drag a corner box to scale · Shift keeps proportions", "S")}
          showActions={!embedded}
        />

        <section
          className={dropping ? "canvas-area dropping" : "canvas-area"}
          ref={containerRef}
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            void importFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="canvas-zoom">{Math.round(zoom * 100)}%</div>
          <StatusHud notice={notice} drag={drag} activeTool={activeTool} />
          {dropping && <div className="drop-hint">Drop SVG files to import</div>}
        </section>

        {rightExpanded ? (
          <aside className="panel side">
            <div className="panel-head">
              <div className="panel-title">
                <h2>Inspector</h2>
                <span
                  className={`save-state ${saveState}`}
                  title={
                    lastSavedAt
                      ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                      : "Autosave is enabled"
                  }
                >
                  <span className="save-dot" />
                  {SAVE_LABELS[saveState]}
                </span>
              </div>
              <button
                aria-label="Collapse inspector"
                className="panel-toggle"
                title="Collapse inspector (])"
                onClick={() => {
                  setRightExpanded(false);
                  notify("Inspector panel", "]");
                }}
              >
                <ChevronRightIcon />
              </button>
            </div>
            <Layers
              nodes={tree}
              selectedIds={selectedIds}
              enteredGroupId={enteredGroupId}
              onSelect={(id, additive) => stageRef.current?.select(id, { additive })}
              onEnter={(id) => stageRef.current?.enterGroup(id)}
              onToggleHidden={(id) => stageRef.current?.toggleVisibility(id)}
              onDelete={(id) => {
                stageRef.current?.deleteById(id);
                notify("Deleted layer");
              }}
              onDuplicate={(id) => {
                stageRef.current?.duplicateById(id);
                notify("Duplicated layer");
              }}
            />

            {error && <p className="empty error">{error}</p>}

            <Inspector
              values={style}
              onChange={(patch) => stageRef.current?.setStyle(patch)}
              onRadius={(radius) => stageRef.current?.setCornerRadius(radius)}
              onRotation={(degrees) => stageRef.current?.setRotation(degrees)}
              onAddText={() => chooseTool("text", "T")}
            />

            <div className="selection-actions">
              <h2>Selection</h2>
              {enteredGroupId && (
                <button className="button exit-group" onClick={() => stageRef.current?.exitGroup()}>
                  ← Exit group
                </button>
              )}
              <p className="empty">
                {hasSelection
                  ? `${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""} · drag to move · Ctrl+drag to copy`
                  : "Click a shape to select it. Drag to move, Ctrl+drag to copy."}
              </p>
              <div className="action-list">
                <ActionButton
                  label="Duplicate"
                  icon={<CopyIcon />}
                  hint="Copy the selection in place."
                  shortcut="⌘D"
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.duplicateSelection()}
                />
                <ActionButton
                  label="Delete"
                  icon={<TrashIcon />}
                  hint="Remove the selected objects. Undo brings them back."
                  shortcut="Del"
                  danger
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.deleteSelection()}
                />
                <ActionButton
                  label="Bring front"
                  icon={<FrontIcon />}
                  hint="Move the selection to the top of the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("front")}
                />
                <ActionButton
                  label="Send back"
                  icon={<BackIcon />}
                  hint="Move the selection behind its siblings."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("back")}
                />
                <ActionButton
                  label="Move up"
                  icon={<UpIcon />}
                  hint="Raise the selection one step in the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("up")}
                />
                <ActionButton
                  label="Move down"
                  icon={<DownIcon />}
                  hint="Lower the selection one step in the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("down")}
                />
                <ActionButton
                  label="Group"
                  icon={<GroupIcon />}
                  hint="Combine selected objects into one group. Shift+click to add objects."
                  shortcut="⌘G"
                  disabled={selectedIds.length < 2}
                  onClick={() => {
                    stageRef.current?.groupSelection();
                    notify("Grouped", "⌘G");
                  }}
                />
                <ActionButton
                  label="Ungroup"
                  icon={<UngroupIcon />}
                  hint="Disassemble a group. Its transform is baked into the children."
                  shortcut="⌘⇧G"
                  disabled={!hasSelection}
                  onClick={() => {
                    stageRef.current?.ungroupSelection();
                    notify("Ungrouped", "⌘⇧G");
                  }}
                />
                <ActionButton
                  label="Detach"
                  icon={<DetachIcon />}
                  hint="Pull a nested object out of its group without moving it on screen."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.detachSelection()}
                />
                <ActionButton
                  label="Object to Path"
                  icon={<NodeIcon />}
                  hint="Convert a shape to a path so you can morph its nodes."
                  shortcut="⌘⇧C"
                  disabled={!hasSelection}
                  onClick={() => {
                    stageRef.current?.convertSelectionToPath();
                    notify("Object to Path", "⌘⇧C");
                  }}
                />
              </div>

              <h2 className="align-heading">Align</h2>
              <div className="action-list">
                <ActionButton
                  label="Align left"
                  icon={<AlignLeftIcon />}
                  hint="Align selected objects by their left edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("left")}
                />
                <ActionButton
                  label="Align center"
                  icon={<AlignCenterIcon />}
                  hint="Align the horizontal centers of the selection."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("center")}
                />
                <ActionButton
                  label="Align right"
                  icon={<AlignRightIcon />}
                  hint="Align selected objects by their right edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("right")}
                />
                <ActionButton
                  label="Align top"
                  icon={<AlignTopIcon />}
                  hint="Align selected objects by their top edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("top")}
                />
                <ActionButton
                  label="Align middle"
                  icon={<AlignMiddleIcon />}
                  hint="Align the vertical centers of the selection."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("middle")}
                />
                <ActionButton
                  label="Align bottom"
                  icon={<AlignBottomIcon />}
                  hint="Align selected objects by their bottom edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("bottom")}
                />
              </div>
            </div>
          </aside>
        ) : (
          <aside className="panel side collapsed">
            <button
              aria-label="Expand inspector"
              className="panel-toggle vertical"
              title="Expand inspector (])"
              onClick={() => {
                setRightExpanded(true);
                notify("Inspector panel", "]");
              }}
            >
              <ChevronLeftIcon />
              <span>Inspector</span>
            </button>
          </aside>
        )}
      </main>

      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
