import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers3,
  Lock,
  LockOpen,
  Monitor,
  Smartphone,
  Spline,
  Square,
  Trash2,
  Type,
} from "lucide-react";

import { StudioContextMenuContent, type StudioMenuActions } from "@/components/studio-context-menu";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DEVICE_MODELS } from "@/devices/catalog";
import { layerOrder, moveLayer, stackNodes, type BoardRow, type StudioNode } from "@/lib/studio";
import { cn } from "@/lib/utils";

import { Panel } from "./panel";

function nodeIcon(node: StudioNode) {
  if (node.type === "line") return Spline;
  if (node.type === "text") return Type;
  if (node.type === "shape")
    return node.imageId !== undefined && node.imageId !== "" ? ImageIcon : Square;
  return DEVICE_MODELS[node.model]?.formFactor === "desktop" ? Monitor : Smartphone;
}

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
    <Panel title="Layers" icon={Layers3} fill bodyClassName="pt-2" dataTour="layers">
      {layers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-background/25 p-3 text-xs text-muted-foreground">
          Add a device or headline to start composing.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {layers.map((node, index) => {
            const Icon = nodeIcon(node);
            const selected = node.id === selectedId;
            return (
              <ContextMenu key={node.id}>
                <ContextMenuTrigger asChild>
                  <li
                    className={cn(
                      "group/row flex items-center gap-0.5 rounded-md transition-colors",
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
                      className="grid size-5 shrink-0 cursor-grab place-items-center text-muted-foreground/50 active:cursor-grabbing"
                      title="Drag to restack"
                      aria-hidden
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                    <button
                      type="button"
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors",
                        selected
                          ? "bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                          : "text-foreground hover:bg-accent",
                      )}
                      onClick={() => onSelect(node.id)}
                    >
                      <Icon
                        className={cn(
                          "size-3.5 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground/70",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{node.name}</span>
                    </button>
                    <div
                      className={cn(
                        "flex shrink-0 items-center transition-opacity",
                        selected
                          ? "opacity-100"
                          : "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100",
                      )}
                    >
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
                          onPatch(
                            node.id,
                            { locked: !node.locked },
                            node.locked ? "Unlock" : "Lock",
                          )
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
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title={`Delete ${node.name}`}
                        aria-label={`Delete ${node.name}`}
                        onClick={() => onRemoveNode(node.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                </ContextMenuTrigger>
                <StudioContextMenuContent
                  targetId={node.id}
                  board={board}
                  nodes={nodes}
                  {...menuActions}
                />
              </ContextMenu>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
