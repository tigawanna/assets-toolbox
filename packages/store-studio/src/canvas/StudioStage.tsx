import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Layer, Stage, Transformer } from "react-konva";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { useProject } from "../data-access-layer/useProject";
import { bakeScale, clamp } from "../model/geometry";
import type { Node } from "../model/schema";
import { useHistory } from "../session/history";
import { useSelection } from "../session/selection";
import { useView } from "../session/view";
import { BoardRenderer } from "./BoardRenderer";
import { Overlays } from "./overlays/Overlays";

interface EditingState {
  id: string;
  value: string;
}

export function StudioStage() {
  const wrapper = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const project = useProject();
  const {
    zoom,
    pan,
    activeBoardId,
    setActiveBoard,
    setPan,
    zoomTo,
    showSliceGuides,
    showSafeZones,
    showStoreCrop,
    tool,
  } = useView();
  const { ids: selectedIds, select } = useSelection();
  const commit = useHistory((state) => state.commit);

  const board = useMemo(
    () => project.boards.find((candidate) => candidate.id === activeBoardId) ?? project.boards[0],
    [project.boards, activeBoardId],
  );
  const preset = board === undefined ? null : getPreset(board.preset);

  useEffect(() => {
    if (board !== undefined && activeBoardId === null) setActiveBoard(board.id);
  }, [board, activeBoardId, setActiveBoard]);

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

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (transformer === null || stage === null) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== undefined);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, board?.id, board?.nodes]);

  function onWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (stage === null) return;
    const pointer = stage.getPointerPosition();
    if (pointer === null) return;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const next = clamp(zoom * (direction > 0 ? 1.08 : 1 / 1.08), 0.05, 4);
    zoomTo(next);
    const worldX = (pointer.x - pan.x) / zoom;
    const worldY = (pointer.y - pan.y) / zoom;
    setPan({ x: pointer.x - worldX * next, y: pointer.y - worldY * next });
  }

  function findNode(id: string): Node | undefined {
    return board?.nodes.find((node) => node.id === id);
  }

  function onDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
    const id = event.target.id();
    if (id === "" || findNode(id) === undefined) return;
    const target = event.target as Konva.Group;
    const x = target.x();
    const y = target.y();
    commit((draft) => {
      const node = draft.boards
        .flatMap((candidate) => candidate.nodes)
        .find((candidate) => candidate.id === id);
      if (node !== undefined) {
        node.x = x;
        node.y = y;
      }
    });
  }

  function onTransformEnd(): void {
    const stage = stageRef.current;
    if (stage === null) return;
    const mutations: Array<{ id: string; node: Konva.Node; scaleX: number; scaleY: number }> = [];
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`);
      if (node === undefined) continue;
      mutations.push({ id, node, scaleX: node.scaleX(), scaleY: node.scaleY() });
    }
    commit((draft) => {
      for (const mutation of mutations) {
        const node = draft.boards
          .flatMap((candidate) => candidate.nodes)
          .find((candidate) => candidate.id === mutation.id);
        if (node !== undefined) {
          const baked = bakeScale(node, mutation.scaleX, mutation.scaleY, 0, 0);
          Object.assign(node, baked);
        }
      }
    });
    for (const mutation of mutations) {
      mutation.node.scaleX(1);
      mutation.node.scaleY(1);
    }
  }

  function startTextEdit(id: string): void {
    const node = findNode(id);
    if (node === undefined || node.type !== "text") return;
    setEditing({ id, value: node.text });
  }

  function commitText(): void {
    if (editing === null) return;
    const value = editing.value;
    const id = editing.id;
    setEditing(null);
    commit((draft) => {
      const node = draft.boards
        .flatMap((candidate) => candidate.nodes)
        .find((candidate) => candidate.id === id);
      if (node !== undefined && node.type === "text") node.text = value;
    });
  }

  const editingNode = editing === null ? undefined : findNode(editing.id);
  const boardWidth = preset === null ? 1080 : preset.width * board!.sliceCount;
  const boardHeight = preset === null ? 1920 : preset.height;
  const panning = spaceDown || tool === "pan";

  return (
    <div className="stage-wrapper" ref={wrapper}>
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
        onDragEnd={(event) => {
          if (event.target === stageRef.current)
            setPan({ x: event.target.x(), y: event.target.y() });
          else onDragEnd(event);
        }}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) select(null);
        }}
      >
        <Layer>
          {board === undefined ? null : (
            <BoardRenderer
              board={board}
              tokens={project.theme.tokens}
              selectedIds={selectedIds}
              showCropGhost={tool === "select"}
              onSelect={(id, additive) =>
                additive ? useSelection.getState().toggle(id) : select(id)
              }
              onEditText={startTextEdit}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 12 || newBox.height < 12 ? oldBox : newBox
            }
            onTransformEnd={onTransformEnd}
          />
        </Layer>
        <Layer listening={false}>
          {preset === null || board === undefined ? null : (
            <Overlays
              board={board}
              width={preset.width}
              height={preset.height}
              showSliceGuides={showSliceGuides}
              showSafeZones={showSafeZones}
              showStoreCrop={showStoreCrop}
            />
          )}
        </Layer>
      </Stage>
      {editing !== null && editingNode !== undefined && editingNode.type === "text" ? (
        <textarea
          className="text-editor"
          autoFocus
          value={editing.value}
          onChange={(event) => setEditing({ id: editing.id, value: event.target.value })}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(null);
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commitText();
          }}
          style={{
            left: editingNode.x * zoom + pan.x,
            top: editingNode.y * zoom + pan.y,
            width: editingNode.width * zoom,
            fontSize: editingNode.font.size * zoom,
            lineHeight: editingNode.lineHeight,
            color:
              project.theme.tokens[
                typeof editingNode.color === "string" ? editingNode.color : editingNode.color.token
              ] ?? "#fff",
            fontFamily: editingNode.font.family,
          }}
        />
      ) : null}
      <div className="stage-status">
        {board === undefined
          ? "No board"
          : `${board.kind} · ${board.sliceCount} slice${board.sliceCount === 1 ? "" : "s"} · ${boardWidth}×${boardHeight} · ${Math.round(zoom * 100)}%`}
      </div>
    </div>
  );
}
