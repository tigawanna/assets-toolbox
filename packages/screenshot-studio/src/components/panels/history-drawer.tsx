import { History, RotateCcw } from "lucide-react";

import { StudioSheet } from "@/components/studio-sheet";
import { Button } from "@/components/ui/button";
import { parseEventSnapshot, type EventRow } from "@/lib/studio";

export function HistoryDrawer({
  events,
  total,
  onRestore,
}: {
  events: EventRow[];
  total: number;
  onRestore: (seq: number) => void;
}) {
  return (
    <StudioSheet
      title="History"
      description="Restore the board and layers to any logged point. Later edits are dropped."
      side="right"
      trigger={
        <Button
          variant="ghost"
          size="xs"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          title="Open history"
          aria-label={total === 0 ? "Open history" : `Open history, ${total} events`}
        >
          <History />
          History
          {total === 0 ? null : (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary">
              {total}
            </span>
          )}
        </Button>
      }
    >
      {events.length === 0 ? (
        <p className="rounded-lg border border-border/70 bg-background/25 p-3 text-xs text-muted-foreground">
          Add a device, then drag it on the board.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-1" data-testid="event-log">
          <span className="absolute top-2 bottom-2 left-7 w-px bg-border" aria-hidden />
          {events.map((event) => {
            const restorable = parseEventSnapshot(event.detail) !== null;
            return (
              <li
                key={event.id}
                className="relative flex items-start gap-2.5 rounded-md py-1.5 pr-1 hover:bg-muted/50"
              >
                <span className="relative z-10 mt-0.5 grid h-5 w-9 shrink-0 place-items-center rounded bg-muted text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border">
                  #{event.seq}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{event.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(event.ts).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs hover:border-primary/50 hover:text-primary"
                  disabled={!restorable}
                  title={
                    restorable
                      ? "Reset the board and layers to this event"
                      : "This event was logged before restore points"
                  }
                  onClick={() => onRestore(event.seq)}
                >
                  <RotateCcw aria-hidden />
                  Restore
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </StudioSheet>
  );
}
