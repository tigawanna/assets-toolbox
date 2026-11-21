import { count } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useState } from "react";

import { Board } from "@/components/canvas/board";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { listPresets } from "@/lib/presets";
import { applySnapshot, eventsCollection, framesCollection } from "@/lib/studio-collections";
import { addFrame, loadStudio, moveBanner, removeFrame } from "@/server/fns";

export function Studio() {
  const frameQuery = useLiveQuery((q) => q.from({ frame: framesCollection }));
  const recentEvents = useLiveQuery((q) =>
    q
      .from({ event: eventsCollection })
      .orderBy(({ event }) => event.seq, "desc")
      .limit(8),
  );
  const eventTotal = useLiveQuery((q) =>
    q.from({ event: eventsCollection }).select(({ event }) => ({ total: count(event.id) })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<"devices" | "layers" | null>(null);
  const presets = listPresets();

  useEffect(() => {
    void loadStudio()
      .then(applySnapshot)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Could not load"),
      );
  }, []);

  async function run(work: () => Promise<Parameters<typeof applySnapshot>[0]>) {
    setError("");
    try {
      await applySnapshot(await work());
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    }
  }

  const play = presets.filter((preset) => preset.store === "play");
  const apple = presets.filter((preset) => preset.store === "app-store");
  const events = recentEvents.data ?? [];
  const total = eventTotal.data[0]?.total ?? 0;
  const frames = frameQuery.data ?? [];
  const selected = frames.find((frame) => frame.id === selectedId) ?? null;

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">Screenshot Studio</span>
        <Button variant="outline" size="sm" onClick={() => setDrawer("devices")}>
          Devices
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDrawer("layers")}>
          Layers
        </Button>
        <span className="text-xs text-muted-foreground">{total} events</span>
      </header>
        {error === "" ? null : <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="min-h-0 flex-1">
          <Board
            frames={frames}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(next) => run(() => moveBanner({ data: { frames: next } }))}
          />
        </div>
        <footer data-testid="event-log" className="h-28 shrink-0 overflow-auto border-t px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Event log</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No edits yet. Add a frame, then drag it.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-xs">
                  <span>#{event.seq}</span>
                  <span>{event.label}</span>
                  <span className="text-muted-foreground">
                    {Math.round(event.x)}, {Math.round(event.y)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </footer>
      <Sheet open={drawer === "devices"} onOpenChange={(open) => setDrawer(open ? "devices" : null)}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Devices</SheetTitle>
            <SheetDescription>Add a slice to the banner. Each slice exports on its own.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-auto px-4 pb-4">
            <PresetGroup
              label="Google Play"
              presets={play}
              onAdd={(presetId) => void run(() => addFrame({ data: { store: "play", presetId } }))}
            />
            <PresetGroup
              label="App Store"
              presets={apple}
              onAdd={(presetId) =>
                void run(() => addFrame({ data: { store: "app-store", presetId } }))
              }
            />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={drawer === "layers"} onOpenChange={(open) => setDrawer(open ? "layers" : null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Layers</SheetTitle>
            <SheetDescription>Slices in the banner, left to right.</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-1 overflow-auto px-4">
            {frames.length === 0 ? (
              <li className="text-sm text-muted-foreground">No slices yet.</li>
            ) : (
              frames
                .slice()
                .sort((a, b) => a.x - b.x)
                .map((frame, index) => (
                  <li key={frame.id}>
                    <button
                      type="button"
                      className={
                        frame.id === selectedId
                          ? "w-full rounded-md bg-muted px-2 py-2 text-left text-sm"
                          : "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      }
                      onClick={() => setSelectedId(frame.id)}
                    >
                      {index + 1}. {frame.label}
                    </button>
                  </li>
                ))
            )}
          </ul>
          {selected === null ? null : (
            <div className="mt-auto flex flex-col gap-2 border-t p-4 text-sm">
              <p className="font-medium">{selected.label}</p>
              <p className="text-muted-foreground">
                {selected.store} · {selected.width}×{selected.height}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const id = selected.id;
                  setSelectedId(null);
                  void run(() => removeFrame({ data: { id } }));
                }}
              >
                Remove slice
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PresetGroup({
  label,
  presets,
  onAdd,
}: {
  label: string;
  presets: ReturnType<typeof listPresets>;
  onAdd: (presetId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      {presets.map((preset) => (
        <Button
          key={`${preset.store}-${preset.id}`}
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => onAdd(preset.id)}
        >
          {preset.label}
        </Button>
      ))}
    </section>
  );
}
