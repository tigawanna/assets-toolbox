import { useEffect, useState } from "react";

import type { LayerNode } from "../canvas/stage";
import { CopyIcon, TrashIcon } from "./icons";

type LayersProps = {
  nodes: LayerNode[];
  selectedIds: string[];
  enteredGroupId: string | null;
  onSelect: (id: string, additive: boolean) => void;
  onEnter: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

export function Layers({
  nodes,
  selectedIds,
  enteredGroupId,
  onSelect,
  onEnter,
  onToggleHidden,
  onDelete,
  onDuplicate,
}: LayersProps) {
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const renderNodes = (items: LayerNode[], depth: number) =>
    items.map((node) => (
      <li key={node.id}>
        <div
          className={`layer depth-${Math.min(depth, 5)}${
            selectedIds.includes(node.id) ? " selected" : ""
          }${node.id === enteredGroupId ? " entered" : ""}${node.hidden ? " is-hidden" : ""}`}
          onContextMenu={(event) => {
            event.preventDefault();
            onSelect(node.id, false);
            setMenuId(node.id);
          }}
        >
          {node.tag === "g" ? (
            <button className="layer-enter" title="Enter group" onClick={() => onEnter(node.id)}>
              ▾
            </button>
          ) : (
            <span className="layer-spacer" />
          )}
          <button
            className="layer-name"
            title={node.id}
            onClick={(event) => onSelect(node.id, event.shiftKey)}
          >
            {node.label}
          </button>
          <span className="layer-tag">{node.tag}</span>
          <button
            className="layer-eye"
            title={node.hidden ? "Show" : "Hide"}
            onClick={() => onToggleHidden(node.id)}
          >
            {node.hidden ? "◌" : "◉"}
          </button>
          <button
            aria-label={`Delete ${node.label}`}
            className="layer-delete"
            title="Delete layer"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
          >
            <TrashIcon />
          </button>

          {menuId === node.id && (
            <div
              className="layer-menu"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => {
                  onDelete(node.id);
                  setMenuId(null);
                }}
              >
                <TrashIcon />
                Delete layer
              </button>
              <button
                onClick={() => {
                  onDuplicate(node.id);
                  setMenuId(null);
                }}
              >
                <CopyIcon />
                Duplicate layer
              </button>
              {node.tag === "g" && (
                <button
                  onClick={() => {
                    onEnter(node.id);
                    setMenuId(null);
                  }}
                >
                  Enter group
                </button>
              )}
            </div>
          )}
        </div>
        {node.children.length > 0 && <ul>{renderNodes(node.children, depth + 1)}</ul>}
      </li>
    ));

  return (
    <div className="layers">
      <h2>Layers</h2>
      {nodes.length === 0 ? (
        <p className="empty">Import an SVG to start building the tree.</p>
      ) : (
        <ul className="layer-tree">{renderNodes(nodes, 0)}</ul>
      )}
    </div>
  );
}
