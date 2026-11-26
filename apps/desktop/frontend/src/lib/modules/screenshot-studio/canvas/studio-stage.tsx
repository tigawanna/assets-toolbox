import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Konva from "konva";
import { LocateFixed } from "lucide-react";
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";

import { BoardContent } from "@/canvas/board-content";
import { Button } from "@/components/ui/button";
import { StudioContextMenuContent, type StudioMenuActions } from "@/components/studio-context-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { parseBandSelection, parseSliceSelection } from "@/lib/bands";
import { storeLabel } from "@/lib/store-rules";
import {
  boardBounds,
  applyCollectionHandleDrag,
  boardCollections,
  COLLECTION_HANDLE,
  FIT_CAMERA_EVENT,
  fitCamera,
  collectionAsBoard,
  collectionFill,
  collectionFrame,
  collectionOrigin,
  collectionSelectionId,
  findCollectionForBand,
  nodesInCollection,
  parseCollectionSelection,
} from "@/lib/scenes";
import {
  DEFAULT_BOARD_ID,
  deviceAspectLocked,
  deviceFrameRatio,
  type AssetRow,
  type BoardRow,
  type LineLink,
  type LinePoint,
  type LinePointEdit,
  type StudioNode,
} from "@/lib/studio";

interface StudioStageProps extends StudioMenuActions {
  board: BoardRow;
  nodes: StudioNode[];
  assets: AssetRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveCollection: (id: string, x: number, y: number) => void;
  onTransform: (
    id: string,
    next: { x: number; y: number; width: number; height: number; rotation: number },
  ) => void;
}

function konvaSelectionId(target: Konva.Node): string | null {
  let current: Konva.Node | null = target;
  while (current !== null) {
    const kind = current.getClassName();
    if (kind === "Stage") return null;
    if (kind === "Transformer") return null;
    const id = current.id();
    if (id !== "") return id;
    current = current.getParent();
  }
  return null;
}

export function StudioStage({
  board,
  nodes,
  assets,
  selectedId,
  onSelect,
  onMove,
  onMoveCollection,
  onTransform,
  duplicateHint,
  onDuplicateNode,
  onRemoveNode,
  onDuplicateSlice,
  onDeleteSlice,
  onDuplicateCollection,
  onRemoveCollection,
  onPatchNode,
  onBringToFront,
  onSendToBack,
}: StudioStageProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const menuTriggerRef = useRef<HTMLSpanElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [zoom, setZoom] = useState(0.28);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [fitted, setFitted] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const collections = boardCollections(board);
  const fallbackId = collections[0]?.id ?? "col-main";
  const bounds = boardBounds(board);
  const viewRef = useRef({ bounds, size });
  viewRef.current = { bounds, size };
  const panning = spaceDown;
  const selectedBandId = parseBandSelection(selectedId);
  const selectedSlice = parseSliceSelection(selectedId);
  const selectedNode =
    selectedId === null ? undefined : nodes.find((node) => node.id === selectedId);
  const selectedCollectionId = (() => {
    const fromCollection = parseCollectionSelection(selectedId);
    if (fromCollection !== null) return fromCollection;
    if (selectedSlice !== null) {
      return selectedSlice.collectionId === "" ? fallbackId : selectedSlice.collectionId;
    }
    if (selectedBandId !== null) {
      const match = findCollectionForBand(board, selectedBandId);
      if (match !== undefined) return match.id;
    }
    return selectedNode?.collectionId ?? null;
  })();
  const boardSelected = selectedId === board.id || selectedId === DEFAULT_BOARD_ID;
  const keepDeviceRatio = selectedNode?.type === "device" && deviceAspectLocked(selectedNode);

  useEffect(() => {
    const element = wrapper.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  function applyFit(): void {
    const view = viewRef.current;
    if (view.size.width < 80 || view.size.height < 80) return;
    const next = fitCamera(view.bounds, view.size);
    setZoom(next.zoom);
    setPan(next.pan);
  }

  useEffect(() => {
    if (fitted || size.height < 80) return;
    applyFit();
    setFitted(true);
  }, [fitted, size.height, size.width]);

  useEffect(() => {
    const fit = () => applyFit();
    window.addEventListener(FIT_CAMERA_EVENT, fit);
    return () => window.removeEventListener(FIT_CAMERA_EVENT, fit);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "0" && !event.altKey) {
        event.preventDefault();
        applyFit();
        return;
      }
      if (event.code !== "Space") return;
      event.preventDefault();
      setSpaceDown(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };
    const clear = () => {
      setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (transformer === null || stage === null) return;
    if (
      selectedId === null ||
      boardSelected ||
      selectedNode?.type === "line" ||
      parseBandSelection(selectedId) !== null ||
      parseSliceSelection(selectedId) !== null ||
      parseCollectionSelection(selectedId) !== null
    ) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    transformer.nodes(node === undefined ? [] : [node]);
    transformer.getLayer()?.batchDraw();
  }, [boardSelected, selectedId, nodes]);

  function onWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
    event.evt.preventDefault();
    const native = event.evt;
    if (native.ctrlKey || native.metaKey) {
      const stage = stageRef.current;
      if (stage === null) return;
      const pointer = stage.getPointerPosition();
      if (pointer === null) return;
      const next = Math.min(2.5, Math.max(0.08, zoom * (native.deltaY > 0 ? 0.92 : 1.08)));
      const worldX = (pointer.x - pan.x) / zoom;
      const worldY = (pointer.y - pan.y) / zoom;
      setZoom(next);
      setPan({ x: pointer.x - worldX * next, y: pointer.y - worldY * next });
      return;
    }
    const across = native.shiftKey || Math.abs(native.deltaX) > Math.abs(native.deltaY);
    let dx = 0;
    let dy = native.deltaY;
    if (across) {
      dx = native.shiftKey ? native.deltaY : native.deltaX;
      dy = 0;
    }
    setPan({ x: pan.x - dx, y: pan.y - dy });
  }

  function onContextMenu(event: Konva.KonvaEventObject<PointerEvent>) {
    event.evt.preventDefault();
    const hit = konvaSelectionId(event.target) ?? selectedId;
    onSelect(hit);
    const native = event.evt;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    const rect = stage?.container().getBoundingClientRect();
    const fromPointer =
      pointer === undefined || pointer === null || rect === undefined
        ? { x: native.clientX, y: native.clientY }
        : { x: rect.left + pointer.x, y: rect.top + pointer.y };
    setMenu({
      x: native.clientX > 0 ? native.clientX : fromPointer.x,
      y: native.clientY > 0 ? native.clientY : fromPointer.y,
      id: hit,
    });
  }

  useLayoutEffect(() => {
    if (menu === null) return;
    menuTriggerRef.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: menu.x,
        clientY: menu.y,
      }),
    );
  }, [menu]);

  function handleLineEdit(id: string, edit: LinePointEdit): void {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node === undefined || node.type !== "line") return;
    const points = [...node.points];
    let index = edit.index;
    if (edit.type === "insert") {
      points.splice(edit.index + 1, 0, edit.point);
      index = edit.index + 1;
    } else if (edit.type === "remove") {
      if (points.length <= 2) return;
      points.splice(edit.index, 1);
      index = Math.min(edit.index, points.length - 1);
    } else {
      points[edit.index] = edit.point;
    }

    let snapped = points[index] ?? { x: 0, y: 0 };
    let link: LineLink | undefined;
    if (edit.type !== "remove") {
      const here = { x: node.x + snapped.x, y: node.y + snapped.y };
      let closest = 18;
      for (const other of nodes) {
        if (other.id === id || other.type !== "line") continue;
        for (let pointIndex = 0; pointIndex < other.points.length; pointIndex += 1) {
          const point = other.points[pointIndex]!;
          const distance = Math.hypot(other.x + point.x - here.x, other.y + point.y - here.y);
          if (distance < closest) {
            closest = distance;
            snapped = {
              x: Math.round(other.x + point.x - node.x),
              y: Math.round(other.y + point.y - node.y),
            };
            link = { point: index, nodeId: other.id, nodePoint: pointIndex };
          }
        }
      }
      points[index] = snapped;
    }

    const links = (node.links ?? []).filter((candidate) => candidate.point !== index);
    if (link !== undefined) links.push(link);
    onPatchNode(id, { points, links }, "Edit line");

    if (edit.type === "remove") return;
    const absolute = { x: node.x + snapped.x, y: node.y + snapped.y };
    const updates = new Map<string, LinePoint[]>();
    const queue = (targetId: string, pointIndex: number, point: LinePoint) => {
      const target = nodes.find((candidate) => candidate.id === targetId);
      if (target === undefined || target.type !== "line" || pointIndex >= target.points.length)
        return;
      const next = updates.get(targetId) ?? [...target.points];
      next[pointIndex] = { x: Math.round(point.x - target.x), y: Math.round(point.y - target.y) };
      updates.set(targetId, next);
    };
    for (const candidate of links) {
      if (candidate.point === index) queue(candidate.nodeId, candidate.nodePoint, absolute);
    }
    for (const other of nodes) {
      if (other.type !== "line" || other.links === undefined) continue;
      for (const candidate of other.links) {
        if (candidate.nodeId === id && candidate.nodePoint === index) {
          queue(other.id, candidate.point, absolute);
        }
      }
    }
    for (const [targetId, nextPoints] of updates) {
      onPatchNode(targetId, { points: nextPoints }, "Edit linked line");
    }
  }

  const menuActions = {
    duplicateHint,
    onDuplicateNode,
    onRemoveNode,
    onDuplicateSlice,
    onDeleteSlice,
    onDuplicateCollection,
    onRemoveCollection,
    onPatchNode,
    onBringToFront,
    onSendToBack,
  };

  return (
    <div
      ref={wrapper}
      className="relative h-full min-h-0 w-full overflow-hidden"
      data-testid="canvas"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable={panning}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onDragEnd={(event) => {
          if (event.target === stageRef.current) {
            setPan({ x: event.target.x(), y: event.target.y() });
            return;
          }
          const id = event.target.id();
          if (
            id === "" ||
            id === board.id ||
            id.startsWith("collection:") ||
            id.startsWith("slice:")
          )
            return;
          onMove(id, event.target.x(), event.target.y());
        }}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          {collections.map((collection) => {
            const origin = collectionOrigin(board, collection.id);
            const size = collectionFrame(collection);
            const width = size.width * collection.sliceCount;
            const height = size.height;
            const fill = collectionFill(collection);
            const collectionSelected =
              selectedCollectionId === collection.id ||
              selectedId === collectionSelectionId(collection.id);
            const sliceHit =
              selectedSlice !== null &&
              (selectedSlice.collectionId === collection.id ||
                (selectedSlice.collectionId === "" && collection.id === fallbackId))
                ? selectedSlice.index
                : null;
            const selectedBand =
              selectedBandId === null
                ? undefined
                : fill.bands.find((band) => band.id === selectedBandId);
            let selectedSpan: { start: number; count: number } | null = null;
            if (selectedBand !== undefined) {
              selectedSpan = { start: selectedBand.start, count: selectedBand.count };
            } else if (sliceHit !== null) {
              selectedSpan = { start: sliceHit, count: 1 };
            }
            const handleWidth = Math.min(width, 2800);
            return (
              <Group key={collection.id} x={origin.x} y={origin.y}>
                <Rect
                  id={collectionSelectionId(collection.id)}
                  name="collection-handle"
                  x={0}
                  y={-COLLECTION_HANDLE}
                  width={handleWidth}
                  height={COLLECTION_HANDLE - 16}
                  fill={collectionSelected ? "#1c271d" : "#141a16"}
                  stroke={collectionSelected ? "#8bd450" : "#3d4a40"}
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  cornerRadius={18}
                  draggable={!panning}
                  dragDistance={4}
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    onSelect(collectionSelectionId(collection.id));
                  }}
                  onMouseEnter={(event) => {
                    const stage = event.target.getStage();
                    if (stage !== null && !panning) stage.container().style.cursor = "grab";
                  }}
                  onMouseLeave={(event) => {
                    const stage = event.target.getStage();
                    if (stage !== null)
                      stage.container().style.cursor = panning ? "grab" : "default";
                  }}
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                    const stage = event.target.getStage();
                    if (stage !== null) stage.container().style.cursor = "grabbing";
                  }}
                  onDragMove={(event) => {
                    event.cancelBubble = true;
                    const handle = event.target;
                    const group = handle.getParent();
                    if (group === null) return;
                    const next = applyCollectionHandleDrag(
                      { x: group.x(), y: group.y() },
                      { x: handle.x(), y: handle.y() },
                    );
                    group.position(next.group);
                    handle.position(next.handle);
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true;
                    const handle = event.target;
                    const group = handle.getParent();
                    if (group === null) return;
                    const next = applyCollectionHandleDrag(
                      { x: group.x(), y: group.y() },
                      { x: handle.x(), y: handle.y() },
                    );
                    group.position(next.group);
                    handle.position(next.handle);
                    onMoveCollection(collection.id, next.group.x, next.group.y);
                    const stage = handle.getStage();
                    if (stage !== null) stage.container().style.cursor = "grab";
                  }}
                />
                {Array.from({ length: 3 }, (_, index) => (
                  <Rect
                    key={`grip-${index}`}
                    x={36 + index * 18}
                    y={-COLLECTION_HANDLE + 42}
                    width={8}
                    height={28}
                    fill="#8bd450"
                    opacity={0.55}
                    cornerRadius={4}
                    listening={false}
                  />
                ))}
                <Text
                  x={100}
                  y={-COLLECTION_HANDLE + 28}
                  text={`${collection.name} · ${storeLabel(collection.store)}`}
                  fontSize={48}
                  fontStyle="bold"
                  fill="#d6ead0"
                  listening={false}
                />
                <BoardContent
                  board={collectionAsBoard(board, collection)}
                  nodes={nodesInCollection(nodes, collection.id, fallbackId)}
                  assets={assets}
                  panning={panning}
                  collectionId={collection.id}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  onLineEdit={handleLineEdit}
                />
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  stroke={collectionSelected || boardSelected ? "#8bd450" : "#4a5a4c"}
                  strokeWidth={collectionSelected || boardSelected ? 4 : 2}
                  strokeScaleEnabled={false}
                  listening={false}
                />
                {selectedSpan === null ? null : (
                  <Rect
                    x={selectedSpan.start * size.width}
                    y={0}
                    width={selectedSpan.count * size.width}
                    height={height}
                    stroke="#8bd450"
                    strokeWidth={4}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                )}
                {Array.from({ length: collection.sliceCount + 1 }, (_, index) => (
                  <Group key={index} listening={false}>
                    <Line
                      points={[index * size.width, 0, index * size.width, height]}
                      stroke="#ffb86b"
                      strokeWidth={1.5}
                      strokeScaleEnabled={false}
                      dash={[8, 6]}
                      opacity={index === 0 || index === collection.sliceCount ? 0.4 : 1}
                    />
                    {index < collection.sliceCount ? (
                      <Text
                        x={index * size.width + 28}
                        y={28}
                        text={`${index + 1}`}
                        fontSize={72}
                        fontStyle="bold"
                        fill="#ffb86b"
                        opacity={
                          selectedSpan !== null &&
                          index >= selectedSpan.start &&
                          index < selectedSpan.start + selectedSpan.count
                            ? 1
                            : 0.55
                        }
                      />
                    ) : null}
                  </Group>
                ))}
              </Group>
            );
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={keepDeviceRatio}
            enabledAnchors={
              keepDeviceRatio
                ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                : [
                    "top-left",
                    "top-center",
                    "top-right",
                    "middle-right",
                    "bottom-right",
                    "bottom-center",
                    "bottom-left",
                    "middle-left",
                  ]
            }
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 24 || newBox.height < 24 ? oldBox : newBox
            }
            onTransformEnd={() => {
              const stage = stageRef.current;
              if (stage === null || selectedId === null || boardSelected) return;
              const target = stage.findOne(`#${selectedId}`);
              if (target === undefined) return;
              const scaleX = target.scaleX();
              const scaleY = target.scaleY();
              target.scale({ x: 1, y: 1 });
              let width = Math.max(24, target.width() * scaleX);
              let height = Math.max(24, target.height() * scaleY);
              if (keepDeviceRatio && selectedNode?.type === "device") {
                const ratio = deviceFrameRatio(selectedNode.model);
                height = Math.max(24, height);
                width = Math.max(24, Math.round(height * ratio));
              }
              onTransform(selectedId, {
                x: target.x(),
                y: target.y(),
                width,
                height,
                rotation: target.rotation(),
              });
            }}
          />
        </Layer>
      </Stage>
      <ContextMenu
        modal={false}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
      >
        <ContextMenuTrigger asChild>
          <span
            ref={menuTriggerRef}
            aria-hidden
            className="fixed size-px"
            style={{ left: menu?.x ?? -1000, top: menu?.y ?? -1000 }}
          />
        </ContextMenuTrigger>
        <StudioContextMenuContent
          targetId={menu?.id ?? null}
          board={board}
          nodes={nodes}
          {...menuActions}
        />
      </ContextMenu>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="xs"
          data-testid="recenter-canvas"
          className="pointer-events-auto bg-background/70 text-foreground hover:bg-background/85"
          title="Fit every scene strip in the view (0)"
          onClick={() => applyFit()}
        >
          <LocateFixed />
          Recenter
        </Button>
        <p className="rounded-md bg-background/50 px-2 py-1 text-xs text-foreground">
          {collections.length} collection{collections.length === 1 ? "" : "s"} ·{" "}
          {Math.round(zoom * 100)}% · Drag the strip title · 0 recenters
        </p>
      </div>
    </div>
  );
}
