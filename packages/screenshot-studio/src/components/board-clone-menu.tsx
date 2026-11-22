import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { StoreName } from "@/lib/studio";

export function BoardCloneMenu({
  disabled,
  align = "right",
  onDuplicate,
  onCloneStore,
}: {
  disabled?: boolean;
  align?: "left" | "right";
  onDuplicate: () => void;
  onCloneStore: (store: StoreName) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function run(work: () => void) {
    setOpen(false);
    work();
  }

  return (
    <div ref={root} className="relative">
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="clone-board"
        title="Duplicate this scene strip, or clone it for Apple or Android below"
        onClick={() => setOpen((current) => !current)}
      >
        <Copy />
        Clone
      </Button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-50 mt-1 w-60 rounded-md border border-border bg-popover p-1 shadow-lg ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            onClick={() => run(onDuplicate)}
          >
            Duplicate
            <span className="text-xs text-muted-foreground">Same size, stacked under this strip</span>
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="clone-apple"
            className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            onClick={() => run(() => onCloneStore("app-store"))}
          >
            Clone for Apple
            <span className="text-xs text-muted-foreground">
              App Store 6.9" frames and iPhone / iPad
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="clone-android"
            className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            onClick={() => run(() => onCloneStore("play"))}
          >
            Clone for Android
            <span className="text-xs text-muted-foreground">Play listing size and Android frames</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
