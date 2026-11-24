import { useCallback, useEffect, useRef, useState } from "react";

import { Stage, type LayerNode, type SelectionStyle } from "./canvas/stage";
import { ActionButton } from "./components/action-button";
import { Inspector } from "./components/inspector";
import { Layers } from "./components/layers";
import { ShortcutsDialog, isShortcutHelp } from "./components/shortcuts";
import { StatusHud, type DragStatus, type Notice } from "./components/status-hud";
import { ToolRail } from "./components/tool-rail";
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
  DetachIcon,
  DownIcon,
  FrontIcon,
  GroupIcon,
  NodeIcon,
  TrashIcon,
  UngroupIcon,
  UpIcon,
} from "./components/icons";
import { toolById } from "./tools/shapes";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const noticeId = useRef(0);
  const noticeTimer = useRef<number | null>(null);

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
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [railExpanded, setRailExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const [style, setStyle] = useState<SelectionStyle | null>(null);

  const notify = useCallback((label: string, keyHint?: string, detail?: string) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, label, keyHint, detail });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1900);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = new Stage(container);
    stageRef.current = stage;
    const sync = () => {
      setZoom(stage.zoomLevel);
      setCanUndo(stage.canUndo);
      setCanRedo(stage.canRedo);
      setDrag(stage.dragState);
      setStyle(stage.getSelectionStyle());
      setTree(stage.getTree());
      setSelectedIds(stage.selectedIds);
      setEnteredGroupId(stage.enteredGroupId);
    };
    const unsubscribe = stage.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

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
      if (meta && event.key.toLowerCase() === "b") {
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
  }, [chooseTool, notify, toggleFocus]);

  const activeTool = toolId ? (toolById(toolId)?.label ?? toolId) : null;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="app">
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
              <h2>Inspector</h2>
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
              {selectedIds.length < 2 && (
                <p className="inline-hint">
                  To group: Shift+click a second object, then press <kbd>Ctrl</kbd> + <kbd>G</kbd>.
                  Ctrl+click selects a shape inside a group.
                </p>
              )}
              {toolId === "corner" && style && !["rect", "path"].includes(style.tag) && (
                <p className="inline-hint">
                  <strong>Morph corners</strong> works on rectangles and 4-node paths. Select one,
                  or use <kbd>N</kbd> (Node / morph) for other paths.
                </p>
              )}
              {toolId === "node" && style?.tag !== "path" && (
                <p className="inline-hint node-hint">
                  <strong>Node tool:</strong> select a path first. Press <kbd>Ctrl</kbd>+
                  <kbd>Shift</kbd>+<kbd>C</kbd> to convert this shape — then square nodes and green
                  <strong> + </strong> dots appear on its segments.
                </p>
              )}
              {toolId === "node" && style?.tag === "path" && (
                <p className="inline-hint node-hint">
                  <strong>Node tool:</strong> drag squares to move nodes, circles to pull bezier
                  handles, or click a green <strong>+</strong> dot on a segment to add a node.{" "}
                  <kbd>S</kbd> toggles smooth/corner, <kbd>Del</kbd> removes the focused node.
                </p>
              )}
              {actionHint && <p className="action-description">{actionHint}</p>}
              <div className="action-list">
                <ActionButton
                  label="Duplicate"
                  icon={<CopyIcon />}
                  hint="Copy the selection in place."
                  shortcut="⌘D"
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.duplicateSelection()}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Delete"
                  icon={<TrashIcon />}
                  hint="Remove the selected objects. Undo brings them back."
                  shortcut="Del"
                  danger
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.deleteSelection()}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Bring front"
                  icon={<FrontIcon />}
                  hint="Move the selection to the top of the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("front")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Send back"
                  icon={<BackIcon />}
                  hint="Move the selection behind its siblings."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("back")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Move up"
                  icon={<UpIcon />}
                  hint="Raise the selection one step in the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("up")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Move down"
                  icon={<DownIcon />}
                  hint="Lower the selection one step in the stacking order."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.reorder("down")}
                  onHover={setActionHint}
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
                  onHover={setActionHint}
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
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Detach"
                  icon={<DetachIcon />}
                  hint="Pull a nested object out of its group without moving it on screen."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.detachSelection()}
                  onHover={setActionHint}
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
                  onHover={setActionHint}
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
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Align center"
                  icon={<AlignCenterIcon />}
                  hint="Align the horizontal centers of the selection."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("center")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Align right"
                  icon={<AlignRightIcon />}
                  hint="Align selected objects by their right edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("right")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Align top"
                  icon={<AlignTopIcon />}
                  hint="Align selected objects by their top edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("top")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Align middle"
                  icon={<AlignMiddleIcon />}
                  hint="Align the vertical centers of the selection."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("middle")}
                  onHover={setActionHint}
                />
                <ActionButton
                  label="Align bottom"
                  icon={<AlignBottomIcon />}
                  hint="Align selected objects by their bottom edges."
                  disabled={!hasSelection}
                  onClick={() => stageRef.current?.align("bottom")}
                  onHover={setActionHint}
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
