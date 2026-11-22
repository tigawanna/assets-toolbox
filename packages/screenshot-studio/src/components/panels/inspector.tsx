import type { ComponentProps } from "react";

import {
  Apple,
  Bot,
  Copy,
  Link2,
  Link2Off,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

import { FillPicker } from "./fill-picker";
import { Panel, SectionLabel } from "./panel";

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
    <div className="grid gap-1.5">
      <Label className="text-xs tracking-widest uppercase">{label}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        className="h-8 bg-background/60 px-2 text-xs tabular-nums"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
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
    <div>
      <SectionLabel count={sliceCount}>Covers slices</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
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
              aria-pressed={covered}
              className={cn(
                "grid size-7 place-items-center rounded-md text-xs font-medium tabular-nums transition-colors",
                covered
                  ? "bg-primary/15 text-primary ring-1 ring-primary"
                  : "bg-background/60 text-muted-foreground ring-1 ring-border hover:ring-muted-foreground hover:text-foreground",
              )}
              onClick={() => onToggle(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Highlighted slices share one background. Click 2 to stretch this fill across 1 and 2.
      </p>
    </div>
  );
}

function ActionButton({
  children,
  danger = false,
  ...props
}: ComponentProps<typeof Button> & { danger?: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-8 justify-start gap-2 bg-background/40 text-xs shadow-none",
        danger
          ? "text-destructive/90 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          : "hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary",
      )}
      {...props}
    >
      {children}
    </Button>
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
    <Panel icon={SlidersHorizontal} title="Inspector">
      <div className="grid gap-4">
        <div>
          <SectionLabel>Scene strip</SectionLabel>
          <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
            <Input
              aria-label="Scene strip name"
              data-testid="strip-name"
              value={board.name}
              className="h-8 bg-background/70 text-sm font-medium"
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
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                {storeLabel(board.store)}
              </span>
              <span aria-hidden>·</span>
              <span>{board.sliceCount} slices</span>
            </p>
          </div>
        </div>

        {showSpan && span !== null ? (
          <>
            <div>
              <SectionLabel>Selected span</SectionLabel>
              <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-2.5">
                <p className="text-sm font-medium text-foreground">
                  {spanLabel(span.start, span.count)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {span.bandId === undefined
                    ? "Using the strip default. Change the fill or cover more slices to make this span its own."
                    : "This background stretches across the highlighted slices."}
                </p>
              </div>
            </div>
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
            <div className="grid gap-1.5">
              {span.bandId === undefined ? null : (
                <ActionButton onClick={onResetSlice}>
                  <Undo2 aria-hidden />
                  Reset to strip default
                </ActionButton>
              )}
              <ActionButton
                data-testid="duplicate-slice"
                disabled={board.sliceCount + span.count > MAX_SLICES}
                title={`Duplicate (${duplicateHint})`}
                onClick={onDuplicateSlice}
              >
                <Copy aria-hidden />
                {span.count > 1
                  ? `Duplicate slices ${span.start + 1}–${span.start + span.count}`
                  : `Duplicate slice ${span.start + 1}`}
              </ActionButton>
              <ActionButton
                danger
                data-testid="delete-slice"
                disabled={board.sliceCount <= 1 || span.count >= board.sliceCount}
                title="Backspace also deletes the selected slice"
                onClick={onDeleteSlice}
              >
                <Trash2 aria-hidden />
                {span.count > 1
                  ? `Delete slices ${span.start + 1}–${span.start + span.count}`
                  : `Delete slice ${span.start + 1}`}
              </ActionButton>
            </div>
          </>
        ) : null}

        {showBoard ? (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Default behind every slice on this strip. Click a numbered slice to give 1, or 1 and
              2, their own fill.
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
            <div>
              <SectionLabel>Store rules</SectionLabel>
              <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Switch listing size and device family on this strip. Clone it first if you still
                  need the other store below.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    data-testid="apply-apple-rules"
                    className="h-8 gap-1.5 bg-background/40 hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary"
                    onClick={() => onApplyStore("app-store")}
                  >
                    <Apple aria-hidden />
                    App Store
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    data-testid="apply-android-rules"
                    className="h-8 gap-1.5 bg-background/40 hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary"
                    onClick={() => onApplyStore("play")}
                  >
                    <Bot aria-hidden />
                    Google Play
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {showNode && node !== null ? (
          <>
            <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Node name"
                  value={node.name}
                  className="h-8 bg-background/70 text-sm font-medium"
                  onChange={(event) => onPatch(node.id, { name: event.target.value }, "Rename")}
                />
                <span className="shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {node.type}
                </span>
              </div>
            </div>

            <div>
              <SectionLabel>Transform</SectionLabel>
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
                  label="Width"
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
                  label="Height"
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
            </div>

            {node.type === "device" ? (
              <div className="grid gap-4">
                <div>
                  <SectionLabel>Device</SectionLabel>
                  <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="xs"
                        variant={deviceAspectLocked(node) ? "secondary" : "outline"}
                        className={cn(
                          "h-8 gap-1.5",
                          deviceAspectLocked(node)
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-background/40 hover:border-primary/50 hover:text-primary",
                        )}
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
                        className="h-8 gap-1.5 bg-background/40 hover:border-primary/50 hover:text-primary"
                        disabled={!deviceLooksStretched(node)}
                        title="Reset width to the catalog ratio and lock it"
                        onClick={() =>
                          onPatch(node.id, restoreDeviceAspect(node), "Restore aspect")
                        }
                      >
                        <RotateCcw />
                        Restore ratio
                      </Button>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Model</Label>
                      <Select
                        value={node.model}
                        onValueChange={(value) =>
                          onPatch(node.id, retargetDevice(node, value as DeviceModelId), "Device")
                        }
                      >
                        <SelectTrigger aria-label="Device model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_GROUPS.map((group) => (
                            <SelectGroup key={group.id}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.ids.map((id) => (
                                <SelectItem key={id} value={id}>
                                  {DEVICE_MODELS[id].label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Frame</Label>
                      <Select
                        value={node.color}
                        onValueChange={(value) =>
                          onPatch(
                            node.id,
                            { color: value as "black" | "white" | "silver" },
                            "Device color",
                          )
                        }
                      >
                        <SelectTrigger aria-label="Device frame color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="black">Black</SelectItem>
                          <SelectItem value="white">White</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
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
              <div>
                <SectionLabel>Copy</SectionLabel>
                <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                  <Label htmlFor="node-copy" className="text-xs">
                    Text
                  </Label>
                  <Textarea
                    id="node-copy"
                    value={node.text}
                    className="min-h-20 text-xs"
                    onChange={(event) =>
                      onPatch(node.id, { text: event.target.value }, "Edit copy")
                    }
                  />
                  <Field
                    label="Size"
                    value={node.fontSize}
                    onChange={(value) =>
                      onPatch(node.id, { fontSize: Math.max(8, value) }, "Type size")
                    }
                  />
                </div>
              </div>
            ) : null}

            {node.type === "shape" ? (
              <div>
                <SectionLabel>Fill</SectionLabel>
                <ColorPicker
                  value={node.fill}
                  onChange={(color) => onPatch(node.id, { fill: color }, "Fill")}
                  label="Shape fill"
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <ActionButton
                data-testid="duplicate-node"
                title={`Duplicate (${duplicateHint})`}
                onClick={() => onDuplicateNode(node.id)}
              >
                <Copy aria-hidden />
                Duplicate node
              </ActionButton>
              <ActionButton danger onClick={() => onRemove(node.id)}>
                <Trash2 aria-hidden />
                Delete node
              </ActionButton>
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
