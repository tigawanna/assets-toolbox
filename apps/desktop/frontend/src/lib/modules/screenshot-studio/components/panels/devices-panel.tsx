import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import {
  Boxes,
  Heading1,
  ImagePlus,
  Layers2,
  Minus,
  Monitor,
  Plus,
  Shapes,
  Spline,
  Smartphone,
  Tablet,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShapeOptionGrid } from "@/components/ui/shape-picker";
import { DEVICE_GROUPS, DEVICE_MODELS, DEVICE_PAIRS, type DeviceModelId } from "@/devices/catalog";
import type { ShapeKind } from "@/lib/studio";
import { cn } from "@/lib/utils";

import { CollapsibleSection, Panel } from "./panel";

function formIcon(id: DeviceModelId): LucideIcon {
  switch (DEVICE_MODELS[id].formFactor) {
    case "phone":
      return Smartphone;
    case "tablet":
      return Tablet;
    case "foldable":
      return Layers2;
    case "desktop":
      return Monitor;
  }
}

function ToolTile({
  icon: Icon,
  label,
  className,
  ...props
}: ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button
      variant="outline"
      className={cn(
        "flex h-auto flex-col items-center gap-1.5 rounded-lg border-border/80 bg-background/40 px-1 py-2.5 text-xs font-medium text-muted-foreground shadow-none hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary",
        className,
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Button>
  );
}

export function DevicesPanel({
  onDevice,
  onPair,
  onText,
  onShape,
  onImage,
  onLine,
}: {
  onDevice: (model: DeviceModelId) => void;
  onPair: (android: DeviceModelId, apple: DeviceModelId) => void;
  onText: (role: "headline" | "subtext") => void;
  onShape: (shape: ShapeKind) => void;
  onImage: (file: File, shape: ShapeKind) => void;
  onLine: (smooth: boolean) => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const pendingImageShape = useRef<ShapeKind>("rounded");
  const [shapeOpen, setShapeOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  return (
    <Panel
      defaultOpen
      className="shrink-0"
      icon={Boxes}
      title="Nodes"
      description="Frames, copy and overlays drop onto the selected slice or screen."
    >
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onImage(file, pendingImageShape.current);
          event.target.value = "";
        }}
      />
      <div className="grid gap-4">
        <CollapsibleSection title="Add element" bodyClassName="grid-cols-3">
          <ToolTile icon={Heading1} label="Headline" onClick={() => onText("headline")} />
          <ToolTile icon={TextCursorInput} label="Subtext" onClick={() => onText("subtext")} />
          <ToolTile icon={Minus} label="Line" onClick={() => onLine(false)} />
          <ToolTile icon={Spline} label="Curve" onClick={() => onLine(true)} />
          <Popover open={shapeOpen} onOpenChange={setShapeOpen}>
            <PopoverTrigger asChild>
              <ToolTile icon={Shapes} label="Shape" />
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="grid gap-3">
                <Label className="text-xs">Add a shape</Label>
                <ShapeOptionGrid
                  onSelect={(shape) => {
                    onShape(shape);
                    setShapeOpen(false);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={imageOpen} onOpenChange={setImageOpen}>
            <PopoverTrigger asChild>
              <ToolTile icon={ImagePlus} label="Image" />
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="grid gap-3">
                <Label className="text-xs">Shape the image</Label>
                <ShapeOptionGrid
                  onSelect={(shape) => {
                    pendingImageShape.current = shape;
                    setImageOpen(false);
                    imageInput.current?.click();
                  }}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The image is clipped to the shape you choose.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </CollapsibleSection>
        <CollapsibleSection title="Stack both stores" bodyClassName="gap-1.5">
          {DEVICE_PAIRS.map((pair) => (
            <Button
              key={pair.id}
              variant="outline"
              className="h-9 justify-start gap-2.5 bg-background/40 px-2.5 text-xs font-medium shadow-none hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary"
              onClick={() => onPair(pair.android, pair.apple)}
            >
              <span className="grid size-5 place-items-center rounded bg-primary/10 text-primary">
                <Layers2 className="size-3" aria-hidden />
              </span>
              {pair.label}
              <Plus className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          ))}
        </CollapsibleSection>
        {DEVICE_GROUPS.map((group) => (
          <CollapsibleSection
            key={group.id}
            title={group.label}
            count={group.ids.length}
            bodyClassName="gap-0.5"
          >
            {group.ids.map((id) => {
              const Icon = formIcon(id);
              return (
                <Button
                  key={id}
                  variant="ghost"
                  size="sm"
                  className="group h-8 justify-start gap-2.5 px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => onDevice(id)}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  <span className="truncate">{DEVICE_MODELS[id].label}</span>
                  <Plus
                    className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Button>
              );
            })}
          </CollapsibleSection>
        ))}
      </div>
    </Panel>
  );
}
