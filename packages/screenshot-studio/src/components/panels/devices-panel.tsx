import { DEVICE_GROUPS, DEVICE_MODELS, DEVICE_PAIRS, type DeviceModelId } from "@/devices/catalog";
import { Button } from "@/components/ui/button";

import { Panel } from "./panel";

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
    <Panel title="Nodes">
      <p className="mb-2 text-xs text-muted-foreground">
        Play and App Store frames live on the same board. Stack a pair so one shot fills both.
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        <Button size="xs" variant="outline" onClick={() => onText("headline")}>
          Headline
        </Button>
        <Button size="xs" variant="outline" onClick={() => onText("subtext")}>
          Subtext
        </Button>
        <Button size="xs" variant="outline" onClick={onShape}>
          Fill
        </Button>
      </div>
      <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Stack both stores</p>
      <div className="mb-3 flex flex-col gap-0.5">
        {DEVICE_PAIRS.map((pair) => (
          <Button
            key={pair.id}
            variant="outline"
            size="sm"
            className="h-8 justify-start px-2 text-foreground"
            onClick={() => onPair(pair.android, pair.apple)}
          >
            {pair.label}
          </Button>
        ))}
      </div>
      {DEVICE_GROUPS.map((group) => (
        <div key={group.id} className="mb-2">
          <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.ids.map((id) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                className="h-8 justify-start px-2 text-foreground hover:bg-accent"
                onClick={() => onDevice(id)}
              >
                {DEVICE_MODELS[id].label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}
