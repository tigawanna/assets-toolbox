import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  LockOpen,
} from "lucide-react";

import { StudioContextMenuContent, type StudioMenuActions } from "@/components/studio-context-menu";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { layerOrder, moveLayer, stackNodes, type BoardRow, type StudioNode } from "@/lib/studio";
import { cn } from "@/lib/utils";

import { Panel } from "./panel";

export function LayersPanel({
  board,
  nodes,
  selectedId,
  onSelect,
  onPatch,
  onRestack,
  duplicateHint,
  onDuplicateNode,
  onRemoveNode,
  onDuplicateSlice,
  onDeleteSlice,
  onDuplicateCollection,
  onRemoveCollection,
}: {
  board: BoardRow;
  nodes: StudioNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>, label: string) => void;
  onRestack: (ids: string[]) => void;
} & Omit<StudioMenuActions, "onPatchNode">) {
  const layers = [...stackNodes(nodes)].reverse();
  const order = layerOrder(nodes);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const menuActions = {
    duplicateHint,
    onDuplicateNode,
    onRemoveNode,
    onDuplicateSlice,
    onDeleteSlice,
    onDuplicateCollection,
    onRemoveCollection,
    onPatchNode: onPatch,
    onBringToFront: (id: string) => onRestack(moveLayer(order, id, 0)),
    onSendToBack: (id: string) => onRestack(moveLayer(order, id, order.length - 1)),
  };

  function dropOn(targetId: string) {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const targetIndex = order.indexOf(targetId);
    onRestack(moveLayer(order, dragId, targetIndex));
    setDragId(null);
    setOverId(null);
  }

  return (
    <Panel title="Layers" fill>
      {layers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a device or headline to start composing.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {layers.map((node, index) => (
            <ContextMenu key={node.id}>
              <ContextMenuTrigger asChild>
                <li
                  className={cn(
                    "flex items-center gap-0.5 rounded-md",
                    overId === node.id && dragId !== node.id && "ring-1 ring-primary/70",
                    dragId === node.id && "opacity-50",
                  )}
                  draggable
                  onContextMenu={() => onSelect(node.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", node.id);
                    setDragId(node.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOverId(node.id);
                  }}
                  onDragLeave={() => {
                    setOverId((current) => (current === node.id ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropOn(node.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  <span
                    className="grid size-6 shrink-0 cursor-grab place-items-center text-muted-foreground active:cursor-grabbing"
                    title="Drag to restack"
                    aria-hidden
                  >
                    <GripVertical className="size-3.5" />
                  </span>
                  <button
                    type="button"
                    className={
                      node.id === selectedId
                        ? "min-w-0 flex-1 rounded-md bg-accent px-2 py-1.5 text-left text-sm"
                        : "min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
                    }
                    onClick={() => onSelect(node.id)}
                  >
                    <span className="mr-2 inline-block size-1.5 rounded-full bg-primary" />
                    {node.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Bring forward"
                    aria-label={`Bring ${node.name} forward`}
                    disabled={index === 0}
                    onClick={() => onRestack(moveLayer(order, node.id, index - 1))}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Send backward"
                    aria-label={`Send ${node.name} backward`}
                    disabled={index === layers.length - 1}
                    onClick={() => onRestack(moveLayer(order, node.id, index + 1))}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={node.locked ? "Unlock" : "Lock"}
                    aria-label={node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
                    onClick={() =>
                      onPatch(node.id, { locked: !node.locked }, node.locked ? "Unlock" : "Lock")
                    }
                  >
                    {node.locked ? <Lock /> : <LockOpen />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={node.hidden ? "Show" : "Hide"}
                    aria-label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
                    onClick={() =>
                      onPatch(node.id, { hidden: !node.hidden }, node.hidden ? "Show" : "Hide")
                    }
                  >
                    {node.hidden ? <EyeOff /> : <Eye />}
                  </Button>
                </li>
              </ContextMenuTrigger>
              <StudioContextMenuContent
                targetId={node.id}
                board={board}
                nodes={nodes}
                {...menuActions}
              />
            </ContextMenu>
          ))}
        </ul>
      )}
    </Panel>
  );
}
