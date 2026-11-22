import { Link2, Link2Off, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVICE_GROUPS, DEVICE_MODELS, type DeviceModelId } from "@/devices/catalog";
import { spanLabel } from "@/lib/bands";
import { storeLabel } from "@/lib/store-rules";
import {
  MAX_SLICES,
  deviceAspectLocked,
  deviceLooksStretched,
  parseBoardFill,
  resizeDevice,
  restoreDeviceAspect,
  retargetDevice,
  type AssetRow,
  type BoardRow,
  type StoreName,
  type StudioNode,
} from "@/lib/studio";

import { FillPicker } from "./fill-picker";
import { Panel } from "./panel";

export interface SliceSpan {
  start: number;
  count: number;
  color: string;
  imageId?: string;
  bandId?: string;
}

function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        className="h-8 border-border bg-background text-foreground"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function CoverChips({
  sliceCount,
  start,
  count,
  onToggle,
}: {
  sliceCount: number;
  start: number;
  count: number;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Covers slices</p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: sliceCount }, (_, index) => {
          const covered = index >= start && index < start + count;
          return (
            <button
              key={index}
              type="button"
              data-testid={`slice-cover-${index + 1}`}
              title={
                covered
                  ? `Remove slice ${index + 1} from this fill`
                  : `Extend this fill to slice ${index + 1}`
              }
              className={
                covered
                  ? "size-7 rounded-md bg-primary/15 text-xs font-medium text-primary ring-1 ring-primary"
                  : "size-7 rounded-md bg-background text-xs text-muted-foreground ring-1 ring-border hover:ring-muted-foreground"
              }
              onClick={() => onToggle(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Highlighted slices share one background. Click 2 to stretch this fill across 1 and 2.
      </p>
    </div>
  );
}

export function Inspector({
  node,
  board,
  boardSelected,
  span,
  assets,
  onPatch,
  onRemove,
  onBoardName,
  onBoardFill,
  onSliceFill,
  onSliceSpan,
  onResetSlice,
  onDeleteSlice,
  onDuplicateSlice,
  onDuplicateNode,
  duplicateHint,
  onImport,
  onApplyStore,
}: {
  node: StudioNode | null;
  board: BoardRow;
  boardSelected: boolean;
  span: SliceSpan | null;
  assets: AssetRow[];
  onPatch: (
    id: string,
    patch: Record<string, unknown>,
    label: string,
    kind?: "edit" | "transform",
  ) => void;
  onRemove: (id: string) => void;
  onBoardName: (name: string) => void;
  onBoardFill: (color: string, imageId?: string) => void;
  onSliceFill: (color: string, imageId?: string) => void;
  onSliceSpan: (index: number) => void;
  onResetSlice: () => void;
  onDeleteSlice: () => void;
  onDuplicateSlice: () => void;
  onDuplicateNode: (id: string) => void;
  duplicateHint: string;
  onImport: (file: File, apply: "board" | "device" | "band") => void;
  onApplyStore: (store: StoreName) => void;
}) {
  const fill = parseBoardFill(board.background);
  const showSpan = span !== null;
  const showBoard = !showSpan && (boardSelected || node === null);
  const showNode = !showSpan && !showBoard && node !== null;
  return (
    <Panel title="Inspector">
      <div className="mb-3 grid gap-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Scene strip</p>
        <Input
          aria-label="Scene strip name"
          data-testid="strip-name"
          value={board.name}
          className="h-8 border-border bg-background text-foreground"
          onChange={(event) => onBoardName(event.target.value)}
          onBlur={(event) => onBoardName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onBoardName(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          {storeLabel(board.store)} · {board.sliceCount} slices
        </p>
      </div>
      {showSpan && span !== null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{spanLabel(span.start, span.count)}</p>
          <p className="text-xs text-muted-foreground">
            {span.bandId === undefined
              ? "Using the strip default. Change the fill or cover more slices to make this span its own."
              : "This background stretches across the highlighted slices."}
          </p>
          <FillPicker
            label="Background"
            color={span.color}
            imageId={span.imageId}
            assets={assets}
            onColor={(color) => onSliceFill(color, span.imageId)}
            onPickAsset={(id) => onSliceFill(span.color, id)}
            onImport={(file) => onImport(file, "band")}
            onClearImage={() => onSliceFill(span.color, undefined)}
          />
          <CoverChips
            sliceCount={board.sliceCount}
            start={span.start}
            count={span.count}
            onToggle={onSliceSpan}
          />
          {span.bandId === undefined ? null : (
            <Button variant="outline" size="sm" onClick={onResetSlice}>
              Reset to strip default
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            data-testid="duplicate-slice"
            disabled={board.sliceCount + span.count > MAX_SLICES}
            title={`Duplicate (${duplicateHint})`}
            onClick={onDuplicateSlice}
          >
            {span.count > 1
              ? `Duplicate slices ${span.start + 1}–${span.start + span.count}`
              : `Duplicate slice ${span.start + 1}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="delete-slice"
            disabled={board.sliceCount <= 1 || span.count >= board.sliceCount}
            title="Backspace also deletes the selected slice"
            onClick={onDeleteSlice}
          >
            {span.count > 1
              ? `Delete slices ${span.start + 1}–${span.start + span.count}`
              : `Delete slice ${span.start + 1}`}
          </Button>
        </div>
      ) : null}
      {showBoard ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Default behind every slice on this strip. Click a numbered slice to give 1, or 1 and 2,
            their own fill.
          </p>
          <FillPicker
            label="Background"
            color={fill.color}
            imageId={fill.imageId}
            assets={assets}
            onColor={(color) => onBoardFill(color, fill.imageId)}
            onPickAsset={(id) => onBoardFill(fill.color, id)}
            onImport={(file) => onImport(file, "board")}
            onClearImage={() => onBoardFill(fill.color, undefined)}
          />
          <div className="grid gap-1">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Store rules</p>
            <p className="text-xs text-muted-foreground">
              Switch listing size and device family on this strip. Clone it first if you still need
              the other store below.
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="outline"
                size="xs"
                data-testid="apply-apple-rules"
                onClick={() => onApplyStore("app-store")}
              >
                Apply {storeLabel("app-store")} rules
              </Button>
              <Button
                variant="outline"
                size="xs"
                data-testid="apply-android-rules"
                onClick={() => onApplyStore("play")}
              >
                Apply {storeLabel("play")} rules
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {showNode && node !== null ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Node name"
              value={node.name}
              className="h-8 border-border bg-background text-foreground"
              onChange={(event) => onPatch(node.id, { name: event.target.value }, "Rename")}
            />
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {node.type}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="X"
              value={node.x}
              onChange={(value) => onPatch(node.id, { x: value }, "Move", "transform")}
            />
            <Field
              label="Y"
              value={node.y}
              onChange={(value) => onPatch(node.id, { y: value }, "Move", "transform")}
            />
            <Field
              label="W"
              value={node.width}
              onChange={(value) =>
                onPatch(
                  node.id,
                  node.type === "device"
                    ? resizeDevice(node, "width", value)
                    : { width: Math.max(24, value) },
                  "Resize",
                  "transform",
                )
              }
            />
            <Field
              label="H"
              value={node.height}
              onChange={(value) =>
                onPatch(
                  node.id,
                  node.type === "device"
                    ? resizeDevice(node, "height", value)
                    : { height: Math.max(24, value) },
                  "Resize",
                  "transform",
                )
              }
            />
            <Field
              label="Rotate"
              value={node.rotation}
              onChange={(value) => onPatch(node.id, { rotation: value }, "Rotate", "transform")}
            />
            <Field
              label="Opacity"
              value={node.opacity}
              step={0.05}
              onChange={(value) =>
                onPatch(node.id, { opacity: Math.min(1, Math.max(0, value)) }, "Opacity")
              }
            />
          </div>
          {node.type === "device" ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  size="xs"
                  variant={deviceAspectLocked(node) ? "outline" : "ghost"}
                  title={
                    deviceAspectLocked(node)
                      ? "Aspect is locked. Unlock to stretch the frame."
                      : "Aspect is unlocked. Lock to keep the device ratio."
                  }
                  onClick={() =>
                    onPatch(
                      node.id,
                      { aspectLocked: !deviceAspectLocked(node) },
                      deviceAspectLocked(node) ? "Unlock aspect" : "Lock aspect",
                    )
                  }
                >
                  {deviceAspectLocked(node) ? <Link2 /> : <Link2Off />}
                  {deviceAspectLocked(node) ? "Aspect locked" : "Aspect unlocked"}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!deviceLooksStretched(node)}
                  title="Reset width to the catalog ratio and lock it"
                  onClick={() => onPatch(node.id, restoreDeviceAspect(node), "Restore aspect")}
                >
                  <RotateCcw />
                  Restore ratio
                </Button>
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Model
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  value={node.model}
                  onChange={(event) =>
                    onPatch(
                      node.id,
                      retargetDevice(node, event.target.value as DeviceModelId),
                      "Device",
                    )
                  }
                >
                  {DEVICE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.ids.map((id) => (
                        <option key={id} value={id}>
                          {DEVICE_MODELS[id].label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Frame
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  value={node.color}
                  onChange={(event) =>
                    onPatch(
                      node.id,
                      { color: event.target.value as "black" | "white" | "silver" },
                      "Device color",
                    )
                  }
                >
                  <option value="black">Black</option>
                  <option value="white">White</option>
                  <option value="silver">Silver</option>
                </select>
              </label>
              <FillPicker
                label="Screen"
                color={node.screenColor ?? "#050505"}
                imageId={node.screenAssetId}
                assets={assets}
                onColor={(color) => onPatch(node.id, { screenColor: color }, "Screen color")}
                onPickAsset={(id) => onPatch(node.id, { screenAssetId: id }, "Screen image")}
                onImport={(file) => onImport(file, "device")}
                onClearImage={() => onPatch(node.id, { screenAssetId: "" }, "Clear screen image")}
              />
            </div>
          ) : null}
          {node.type === "text" ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Copy
                <textarea
                  className="min-h-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  value={node.text}
                  onChange={(event) => onPatch(node.id, { text: event.target.value }, "Edit copy")}
                />
              </label>
              <Field
                label="Size"
                value={node.fontSize}
                onChange={(value) =>
                  onPatch(node.id, { fontSize: Math.max(8, value) }, "Type size")
                }
              />
            </div>
          ) : null}
          {node.type === "shape" ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Fill
              <Input
                type="color"
                value={node.fill}
                className="h-8 border-border bg-background"
                onChange={(event) => onPatch(node.id, { fill: event.target.value }, "Fill")}
              />
            </label>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            data-testid="duplicate-node"
            title={`Duplicate (${duplicateHint})`}
            onClick={() => onDuplicateNode(node.id)}
          >
            Duplicate node
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRemove(node.id)}>
            Delete node
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
