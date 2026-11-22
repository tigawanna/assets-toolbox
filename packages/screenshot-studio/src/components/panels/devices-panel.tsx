import {
  Boxes,
  Heading1,
  Layers2,
  Monitor,
  PaintBucket,
  Plus,
  Smartphone,
  Tablet,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEVICE_GROUPS, DEVICE_MODELS, DEVICE_PAIRS, type DeviceModelId } from "@/devices/catalog";

import { Panel, SectionLabel } from "./panel";

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
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="flex h-auto flex-col items-center gap-1.5 rounded-lg border-border/80 bg-background/40 px-1 py-2.5 text-xs font-medium text-muted-foreground shadow-none hover:border-primary/50 hover:bg-primary/[0.07] hover:text-primary"
      onClick={onClick}
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
}: {
  onDevice: (model: DeviceModelId) => void;
  onPair: (android: DeviceModelId, apple: DeviceModelId) => void;
  onText: (role: "headline" | "subtext") => void;
  onShape: () => void;
}) {
  return (
    <Panel icon={Boxes} title="Nodes" description="Frames and copy drop onto the selected slice.">
      <div className="grid gap-4">
        <div>
          <SectionLabel>Add element</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            <ToolTile icon={Heading1} label="Headline" onClick={() => onText("headline")} />
            <ToolTile icon={TextCursorInput} label="Subtext" onClick={() => onText("subtext")} />
            <ToolTile icon={PaintBucket} label="Fill" onClick={onShape} />
          </div>
        </div>
        <div>
          <SectionLabel>Stack both stores</SectionLabel>
          <div className="grid gap-1.5">
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
          </div>
        </div>
        {DEVICE_GROUPS.map((group) => (
          <div key={group.id}>
            <SectionLabel count={group.ids.length}>{group.label}</SectionLabel>
            <div className="grid gap-0.5">
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
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
