import type { ComponentProps, ReactNode } from "react";

import {
  Apple,
  Bot,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Link2,
  Link2Off,
  Minus,
  Plus,
  RotateCcw,
  Spline,
  SlidersHorizontal,
  Trash2,
  Undo2,
  type LucideIcon,
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
import { ShapePicker } from "@/components/ui/shape-picker";
import { Textarea } from "@/components/ui/textarea";
import { DEVICE_GROUPS, DEVICE_MODELS, type DeviceModelId } from "@/devices/catalog";
import { spanLabel } from "@/lib/bands";
import { storeLabel } from "@/lib/store-rules";
import {
  MAX_SLICES,
  deviceAspectLocked,
  deviceLooksStretched,
  deviceRadii,
  nodeZ,
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
import { CollapsibleSection, Panel, SectionLabel } from "./panel";

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
    <CollapsibleSection title="Covers slices" count={sliceCount}>
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
    </CollapsibleSection>
  );
}

function ActionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-0.5 rounded-lg border border-border/70 bg-background/25 p-1">
      {children}
    </div>
  );
}

function ActionRow({
  icon: Icon,
  hint,
  tone = "default",
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & {
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 w-full justify-start gap-2.5 rounded-md px-2 text-xs font-medium shadow-none",
        tone === "danger"
          ? "text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
          : "text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded border",
          tone === "danger"
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-primary/20 bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">{children}</span>
      {hint === undefined ? null : (
        <kbd className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground">
          {hint}
        </kbd>
      )}
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
  onStack,
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
  onStack: (where: "front" | "back") => void;
  onImport: (file: File, apply: "board" | "device" | "band" | "overlay") => void;
  onApplyStore: (store: StoreName) => void;
}) {
  const fill = parseBoardFill(board.background);
  const showSpan = span !== null;
  const showBoard = !showSpan && (boardSelected || node === null);
  const showNode = !showSpan && !showBoard && node !== null;

  return (
    <Panel fill icon={SlidersHorizontal} title="Properties">
      <div className="grid gap-4">
        <CollapsibleSection title="Scene strip">
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
        </CollapsibleSection>

        {showSpan && span !== null ? (
          <>
            <CollapsibleSection title="Selected span">
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
            </CollapsibleSection>
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
            <div>
              <SectionLabel>Actions</SectionLabel>
              <ActionGroup>
                {span.bandId === undefined ? null : (
                  <ActionRow icon={Undo2} onClick={onResetSlice}>
                    Reset to strip default
                  </ActionRow>
                )}
                <ActionRow
                  icon={Copy}
                  hint={duplicateHint}
                  data-testid="duplicate-slice"
                  disabled={board.sliceCount + span.count > MAX_SLICES}
                  title={`Duplicate (${duplicateHint})`}
                  onClick={onDuplicateSlice}
                >
                  {span.count > 1
                    ? `Duplicate slices ${span.start + 1}–${span.start + span.count}`
                    : `Duplicate slice ${span.start + 1}`}
                </ActionRow>
                <ActionRow
                  icon={Trash2}
                  tone="danger"
                  hint="Del"
                  data-testid="delete-slice"
                  disabled={board.sliceCount <= 1 || span.count >= board.sliceCount}
                  title="Backspace also deletes the selected slice"
                  onClick={onDeleteSlice}
                >
                  {span.count > 1
                    ? `Delete slices ${span.start + 1}–${span.start + span.count}`
                    : `Delete slice ${span.start + 1}`}
                </ActionRow>
              </ActionGroup>
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
            <CollapsibleSection title="Store rules">
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
            </CollapsibleSection>
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

            <CollapsibleSection title="Transform">
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
                <Field
                  label="Z order"
                  value={nodeZ(node)}
                  onChange={(value) => onPatch(node.id, { z: Math.round(value) }, "Z order")}
                />
              </div>
            </CollapsibleSection>

            {node.type === "device" ? (
              <div className="grid gap-4">
                <CollapsibleSection title="Device">
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
                </CollapsibleSection>
                <CollapsibleSection title="Corners">
                  <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Field
                        label="Screen radius"
                        value={deviceRadii(node).screen}
                        onChange={(value) =>
                          onPatch(node.id, { screenRadius: Math.max(0, value) }, "Screen radius")
                        }
                      />
                      <Field
                        label="Frame radius"
                        value={deviceRadii(node).frame}
                        onChange={(value) =>
                          onPatch(node.id, { frameRadius: Math.max(0, value) }, "Frame radius")
                        }
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Corner radii are in screen pixels. Set a value to override the device preset.
                    </p>
                  </div>
                </CollapsibleSection>
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
              <CollapsibleSection title="Copy">
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
              </CollapsibleSection>
            ) : null}

            {node.type === "line" ? (
              <>
                <CollapsibleSection title="Line">
                  <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                    <ColorPicker
                      value={node.stroke}
                      label="Line color"
                      onChange={(stroke) => onPatch(node.id, { stroke }, "Line color")}
                    />
                    <Field
                      label="Stroke width"
                      value={node.strokeWidth}
                      onChange={(value) =>
                        onPatch(node.id, { strokeWidth: Math.max(1, value) }, "Stroke width")
                      }
                    />
                    <Button
                      variant={node.smooth ? "secondary" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 gap-2 justify-start",
                        node.smooth && "bg-primary/10 text-primary hover:bg-primary/15",
                      )}
                      onClick={() => onPatch(node.id, { smooth: !node.smooth }, "Curve")}
                    >
                      <Spline aria-hidden />
                      {node.smooth ? "Smooth curve" : "Straight segments"}
                    </Button>
                    {node.smooth ? (
                      <Field
                        label="Tension"
                        value={node.tension ?? 0.4}
                        step={0.05}
                        onChange={(value) =>
                          onPatch(
                            node.id,
                            { tension: Math.max(0, Math.min(1, value)) },
                            "Curve tension",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title={`Points (${node.points.length})`}>
                  <ActionGroup>
                    <ActionRow
                      icon={Plus}
                      onClick={() => {
                        const points = [...node.points];
                        const last = points[points.length - 1]!;
                        const before = points[points.length - 2] ?? last;
                        points.splice(points.length - 1, 0, {
                          x: Math.round((before.x + last.x) / 2),
                          y: Math.round((before.y + last.y) / 2),
                        });
                        onPatch(node.id, { points }, "Add point");
                      }}
                    >
                      Add point
                    </ActionRow>
                    <ActionRow
                      icon={Minus}
                      disabled={node.points.length <= 2}
                      onClick={() =>
                        onPatch(node.id, { points: node.points.slice(0, -1) }, "Remove point")
                      }
                    >
                      Remove last point
                    </ActionRow>
                  </ActionGroup>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Drag the circles on the canvas to move points, the small dots to insert one, and
                    double-click a point to remove it. Drag an endpoint near another line to connect
                    them.
                  </p>
                </CollapsibleSection>
              </>
            ) : null}

            {node.type === "shape" ? (
              <>
                <CollapsibleSection title="Overlay">
                  <div className="grid gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                    <ShapePicker
                      value={node.shape}
                      onChange={(shape) => onPatch(node.id, { shape }, "Shape")}
                    />
                    {node.shape === "rect" || node.shape === "rounded" ? (
                      <Field
                        label="Corner radius"
                        value={node.radius}
                        onChange={(value) =>
                          onPatch(node.id, { radius: Math.max(0, value) }, "Corner radius")
                        }
                      />
                    ) : null}
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sits on its own layer above the screen, never in its background.
                    </p>
                  </div>
                </CollapsibleSection>
                <FillPicker
                  label="Fill"
                  color={node.fill}
                  imageId={node.imageId}
                  assets={assets}
                  onColor={(color) => onPatch(node.id, { fill: color }, "Fill")}
                  onPickAsset={(id) => onPatch(node.id, { imageId: id }, "Overlay image")}
                  onImport={(file) => onImport(file, "overlay")}
                  onClearImage={() => onPatch(node.id, { imageId: "" }, "Clear image")}
                />
              </>
            ) : null}

            <div>
              <SectionLabel>Actions</SectionLabel>
              <ActionGroup>
                <ActionRow
                  icon={Copy}
                  hint={duplicateHint}
                  data-testid="duplicate-node"
                  title={`Duplicate (${duplicateHint})`}
                  onClick={() => onDuplicateNode(node.id)}
                >
                  Duplicate node
                </ActionRow>
                <ActionRow icon={ChevronsUp} onClick={() => onStack("front")}>
                  Bring to front
                </ActionRow>
                <ActionRow icon={ChevronsDown} onClick={() => onStack("back")}>
                  Send to back
                </ActionRow>
                <ActionRow icon={Trash2} tone="danger" hint="Del" onClick={() => onRemove(node.id)}>
                  Delete node
                </ActionRow>
              </ActionGroup>
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
