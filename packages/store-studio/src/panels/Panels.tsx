import { useRef } from "react";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { Panel } from "./Panel";
import { assetUrlForId, importAsset } from "../data-access-layer/assets";
import { useProject } from "../data-access-layer/useProject";
import { updateProject } from "../data-access-layer/project";
import { presetForKind } from "../model/migrate";
import type { BoardKind, Node } from "../model/schema";
import { uid } from "../templates/factory";
import { useHistory } from "../session/history";
import { useSelection } from "../session/selection";
import { useView } from "../session/view";

const BOARD_KINDS: BoardKind[] = [
  "phone",
  "tablet",
  "foldable",
  "chromebook",
  "feature",
  "iphone",
  "ipad",
];

export function BoardTabs() {
  const project = useProject();
  const { activeBoardId, setActiveBoard } = useView();
  const commit = useHistory((state) => state.commit);
  return (
    <div className="board-tabs">
      {project.boards.map((board) => (
        <button
          key={board.id}
          type="button"
          className={
            board.id === activeBoardId || (activeBoardId === null && board === project.boards[0])
              ? "tab active"
              : "tab"
          }
          onClick={() => setActiveBoard(board.id)}
        >
          {board.kind}
        </button>
      ))}
      <select
        aria-label="Add board"
        value=""
        onChange={(event) => {
          const kind = event.target.value as BoardKind | "";
          if (kind === "") return;
          commit((draft) => {
            const presetId = presetForKind(kind, draft.store);
            const preset = getPreset(presetId);
            draft.boards.push({
              id: uid("board"),
              kind,
              preset: presetId,
              sliceCount: 4,
              background: { type: "solid", color: { token: "background" } },
              nodes: [],
              sliceMeta: Array.from({ length: 4 }, () => ({})),
            });
            void preset;
          });
        }}
      >
        <option value="">+ Board</option>
        {BOARD_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SliceStrip() {
  const project = useProject();
  const { activeBoardId, activeSlice, setActiveSlice } = useView();
  const commit = useHistory((state) => state.commit);
  const board =
    project.boards.find((candidate) => candidate.id === activeBoardId) ?? project.boards[0];
  if (board === undefined) return <div className="panel">No board</div>;

  function changeCount(delta: number): void {
    commit((draft) => {
      const target = draft.boards.find((candidate) => candidate.id === board!.id);
      if (target === undefined) return;
      const next = Math.max(1, Math.min(10, target.sliceCount + delta));
      target.sliceCount = next;
      while (target.sliceMeta.length < next) target.sliceMeta.push({});
      target.sliceMeta.length = next;
    });
  }

  function move(index: number, direction: -1 | 1): void {
    commit((draft) => {
      const target = draft.boards.find((candidate) => candidate.id === board!.id);
      if (target === undefined) return;
      const swap = index + direction;
      if (swap < 0 || swap >= target.sliceCount) return;
      const meta = target.sliceMeta[index]!;
      target.sliceMeta[index] = target.sliceMeta[swap]!;
      target.sliceMeta[swap] = meta;
      const shift = direction * getPreset(target.preset).width;
      for (const node of target.nodes) {
        const center = node.x + node.width / 2;
        const slice = Math.floor(center / getPreset(target.preset).width);
        if (slice === index) node.x += shift;
        else if (slice === swap) node.x -= shift;
      }
    });
    setActiveSlice(activeSlice + direction);
  }

  return (
    <Panel
      id="slices"
      title="Slices"
      className="slice-strip"
      actions={
        <span className="controls">
          <button type="button" onClick={() => changeCount(-1)} aria-label="Remove slice">
            −
          </button>
          <span>{board.sliceCount}</span>
          <button type="button" onClick={() => changeCount(1)} aria-label="Add slice">
            +
          </button>
        </span>
      }
    >
      <div className="slice-list">
        {board.sliceMeta.map((meta, index) => (
          <div
            key={index}
            className={index === activeSlice ? "slice-card active" : "slice-card"}
            onClick={() => setActiveSlice(index)}
          >
            <div
              className="slice-thumb"
              style={{
                background: `linear-gradient(150deg, hsl(${index * 47} 60% 32%), hsl(${index * 47 + 40} 55% 18%))`,
              }}
            >
              <span>{index + 1}</span>
            </div>
            <input
              aria-label={`Alt text for slice ${index + 1}`}
              placeholder="Alt text"
              value={meta.alt ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateProject((draft) => {
                  const target = draft.boards.find((candidate) => candidate.id === board!.id);
                  if (target?.sliceMeta[index] !== undefined) target.sliceMeta[index]!.alt = value;
                });
              }}
            />
            <span className="slice-controls">
              <button type="button" onClick={() => move(index, -1)} aria-label="Move left">
                ←
              </button>
              <button type="button" onClick={() => move(index, 1)} aria-label="Move right">
                →
              </button>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Layers() {
  const project = useProject();
  const { activeBoardId } = useView();
  const { ids, select, toggle } = useSelection();
  const commit = useHistory((state) => state.commit);
  const board =
    project.boards.find((candidate) => candidate.id === activeBoardId) ?? project.boards[0];
  if (board === undefined) return null;

  function mutateNode(id: string, fn: (node: Node) => void): void {
    commit((draft) => {
      const node = draft.boards
        .flatMap((candidate) => candidate.nodes)
        .find((candidate) => candidate.id === id);
      if (node !== undefined) fn(node);
    });
  }

  return (
    <Panel id="layers" title="Layers" className="layers">
      {[...board.nodes].reverse().map((node) => (
        <div key={node.id} className={ids.includes(node.id) ? "layer-row selected" : "layer-row"}>
          <button
            type="button"
            className="layer-name"
            onClick={(event) => (event.shiftKey ? toggle(node.id) : select(node.id))}
          >
            <span className="node-dot" data-type={node.type} />
            {node.name}
          </button>
          <button
            type="button"
            title="Lock"
            onClick={() =>
              mutateNode(node.id, (item) => {
                item.locked = item.locked !== true;
              })
            }
          >
            {node.locked === true ? "🔒" : "🔓"}
          </button>
          <button
            type="button"
            title="Hide"
            onClick={() =>
              mutateNode(node.id, (item) => {
                item.hidden = item.hidden !== true;
              })
            }
          >
            {node.hidden === true ? "◌" : "◉"}
          </button>
          <button
            type="button"
            title="Move up"
            onClick={() =>
              commit((draft) => {
                const target = draft.boards.find((candidate) => candidate.id === board!.id);
                const index = target?.nodes.findIndex((item) => item.id === node.id) ?? -1;
                if (target !== undefined && index >= 0 && index + 1 < target.nodes.length) {
                  [target.nodes[index], target.nodes[index + 1]] = [
                    target.nodes[index + 1]!,
                    target.nodes[index]!,
                  ];
                }
              })
            }
          >
            ↑
          </button>
        </div>
      ))}
      {board.nodes.length === 0 ? (
        <p className="hint">Add a device or template to get started.</p>
      ) : null}
    </Panel>
  );
}

export function Assets() {
  const project = useProject();
  const fileInput = useRef<HTMLInputElement>(null);
  const commit = useHistory((state) => state.commit);
  return (
    <Panel
      id="assets"
      title="Assets"
      className="assets"
      actions={
        <button type="button" onClick={() => fileInput.current?.click()}>
          + Import
        </button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          void Promise.all(files.map((file) => importAsset(file)));
          event.target.value = "";
        }}
      />
      <div className="asset-grid">
        {Object.entries(project.assets).map(([id, record]) => {
          const url = assetUrlForId(id);
          return (
            <button
              key={id}
              type="button"
              className="asset-card"
              title={`${record.kind} · ${record.width}×${record.height}`}
              onClick={() =>
                commit((draft) => {
                  const board =
                    draft.boards.find(
                      (candidate) => candidate.id === useView.getState().activeBoardId,
                    ) ?? draft.boards[0];
                  if (board === undefined) return;
                  board.nodes.push({
                    id: uid("image"),
                    name: record.file,
                    type: "image",
                    x: 80,
                    y: 80,
                    width: 500,
                    height: 500,
                    rotation: 0,
                    opacity: 1,
                    assetId: id,
                    fit: "contain",
                    mask: "rect",
                    radius: 0,
                  });
                })
              }
            >
              {url === "" ? <span>{record.kind}</span> : <img src={url} alt={record.file} />}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
