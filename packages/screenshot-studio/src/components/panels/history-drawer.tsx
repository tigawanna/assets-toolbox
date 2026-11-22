import { History } from "lucide-react";

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
          title="Open history"
          aria-label={total === 0 ? "Open history" : `Open history, ${total} events`}
        >
          <History />
          History
          {total === 0 ? null : <span className="text-muted-foreground">{total}</span>}
        </Button>
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a device, then drag it on the board.</p>
      ) : (
        <ol className="flex flex-col gap-1" data-testid="event-log">
          {events.map((event) => {
            const restorable = parseEventSnapshot(event.detail) !== null;
            return (
              <li
                key={event.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <span className="mt-0.5 w-10 shrink-0 text-xs tabular-nums text-muted-foreground">
                  #{event.seq}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.ts).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!restorable}
                  title={
                    restorable
                      ? "Reset the board and layers to this event"
                      : "This event was logged before restore points"
                  }
                  onClick={() => onRestore(event.seq)}
                >
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
