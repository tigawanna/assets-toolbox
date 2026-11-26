import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { DEVICE_GROUPS, DEVICE_MODELS, type DeviceModelId } from "@/devices/catalog";
import { parseBandSelection, parseSliceSelection, spanLabel } from "@/lib/bands";
import {
  boardCollections,
  collectionFill,
  findCollection,
  findCollectionForBand,
  parseCollectionSelection,
} from "@/lib/scenes";
import {
  DEFAULT_BOARD_ID,
  MAX_SLICES,
  deviceAspectLocked,
  deviceLooksStretched,
  restoreDeviceAspect,
  retargetDevice,
  type BoardRow,
  type StudioNode,
} from "@/lib/studio";

export interface StudioMenuActions {
  duplicateHint: string;
  onDuplicateNode: (id: string) => void;
  onRemoveNode: (id: string) => void;
  onDuplicateSlice: () => void;
  onDeleteSlice: () => void;
  onDuplicateCollection: (id: string) => void;
  onRemoveCollection: (id: string) => void;
  onPatchNode: (id: string, patch: Record<string, unknown>, label: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
}

export function StudioContextItems({
  targetId,
  board,
  nodes,
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
}: {
  targetId: string | null;
  board: BoardRow;
  nodes: StudioNode[];
} & StudioMenuActions) {
  const node = targetId === null ? undefined : nodes.find((item) => item.id === targetId);
  if (node !== undefined) {
    return (
      <>
        <ContextMenuLabel>{node.name}</ContextMenuLabel>
        <ContextMenuItem data-testid="context-duplicate" onSelect={() => onDuplicateNode(node.id)}>
          Duplicate
          <ContextMenuShortcut>{duplicateHint}</ContextMenuShortcut>
        </ContextMenuItem>
        {node.type === "device" ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger data-testid="context-change-device">
              Change device
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-52">
              <ContextMenuRadioGroup
                value={node.model}
                onValueChange={(value) =>
                  onPatchNode(node.id, retargetDevice(node, value as DeviceModelId), "Device")
                }
              >
                {DEVICE_GROUPS.map((group) => (
                  <div key={group.id}>
                    <ContextMenuLabel className="text-xs tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </ContextMenuLabel>
                    {group.ids.map((id) => (
                      <ContextMenuRadioItem key={id} value={id}>
                        {DEVICE_MODELS[id].label}
                      </ContextMenuRadioItem>
                    ))}
                  </div>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        {node.type === "device" ? (
          <>
            <ContextMenuItem
              onSelect={() =>
                onPatchNode(
                  node.id,
                  { aspectLocked: !deviceAspectLocked(node) },
                  deviceAspectLocked(node) ? "Unlock aspect" : "Lock aspect",
                )
              }
            >
              {deviceAspectLocked(node) ? "Unlock aspect ratio" : "Lock aspect ratio"}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!deviceLooksStretched(node)}
              onSelect={() => onPatchNode(node.id, restoreDeviceAspect(node), "Restore aspect")}
            >
              Restore aspect ratio
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuItem
          onSelect={() =>
            onPatchNode(node.id, { locked: !node.locked }, node.locked ? "Unlock" : "Lock")
          }
        >
          {node.locked ? "Unlock" : "Lock"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            onPatchNode(node.id, { hidden: !node.hidden }, node.hidden ? "Show" : "Hide")
          }
        >
          {node.hidden ? "Show" : "Hide"}
        </ContextMenuItem>
        {onBringToFront === undefined ? null : (
          <ContextMenuItem onSelect={() => onBringToFront(node.id)}>Bring to front</ContextMenuItem>
        )}
        {onSendToBack === undefined ? null : (
          <ContextMenuItem onSelect={() => onSendToBack(node.id)}>Send to back</ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          data-testid="context-delete"
          onSelect={() => onRemoveNode(node.id)}
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </>
    );
  }

  const collectionHit = parseCollectionSelection(targetId);
  const parsedSlice = parseSliceSelection(targetId);
  const bandId = parseBandSelection(targetId);
  const collection = findCollection(
    board,
    collectionHit ??
      parsedSlice?.collectionId ??
      (bandId === null ? undefined : findCollectionForBand(board, bandId)?.id),
  );
  const fill = collectionFill(collection);
  const band = bandId === null ? undefined : fill.bands.find((item) => item.id === bandId);
  let span: { start: number; count: number } | null = null;
  if (band !== undefined) {
    span = { start: band.start, count: band.count };
  } else if (parsedSlice !== null) {
    span = { start: parsedSlice.index, count: 1 };
  }

  if (span !== null) {
    const canDuplicate = collection.sliceCount + span.count <= MAX_SLICES;
    const canDelete = collection.sliceCount > 1 && span.count < collection.sliceCount;
    return (
      <>
        <ContextMenuLabel>{spanLabel(span.start, span.count)}</ContextMenuLabel>
        <ContextMenuItem
          data-testid="context-duplicate"
          disabled={!canDuplicate}
          onSelect={onDuplicateSlice}
        >
          Duplicate
          <ContextMenuShortcut>{duplicateHint}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          data-testid="context-delete"
          disabled={!canDelete}
          onSelect={onDeleteSlice}
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </>
    );
  }

  const boardHit =
    targetId === null ||
    targetId === board.id ||
    targetId === DEFAULT_BOARD_ID ||
    collectionHit !== null;
  if (boardHit) {
    return (
      <>
        <ContextMenuLabel>{collection.name}</ContextMenuLabel>
        <ContextMenuItem
          data-testid="context-duplicate-strip"
          onSelect={() => onDuplicateCollection(collection.id)}
        >
          Duplicate strip
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          data-testid="context-delete-strip"
          disabled={boardCollections(board).length <= 1}
          onSelect={() => onRemoveCollection(collection.id)}
        >
          Delete strip
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </>
    );
  }
  return (
    <>
      <ContextMenuLabel>Canvas</ContextMenuLabel>
      <ContextMenuItem disabled>Select a node or slice</ContextMenuItem>
    </>
  );
}

export function StudioContextMenuContent(
  props: {
    targetId: string | null;
    board: BoardRow;
    nodes: StudioNode[];
  } & StudioMenuActions,
) {
  return (
    <ContextMenuContent data-testid="studio-context-menu">
      <StudioContextItems {...props} />
    </ContextMenuContent>
  );
}
