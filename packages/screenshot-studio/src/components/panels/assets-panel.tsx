import { useRef, useState } from "react";
import { Images } from "lucide-react";

import { StudioSheet } from "@/components/studio-sheet";
import { Button } from "@/components/ui/button";
import type { AssetRow } from "@/lib/studio";
import { cn } from "@/lib/utils";

export function AssetsDrawer({
  assets,
  activeId,
  onImport,
  onPick,
}: {
  assets: AssetRow[];
  activeId?: string;
  onImport: (file: File) => void;
  onPick: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dropping, setDropping] = useState(false);

  function takeFiles(list: FileList | null) {
    if (list === null) return;
    for (const file of list) {
      if (file.type.startsWith("image/") || file.name.endsWith(".svg")) onImport(file);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        tabIndex={-1}
        multiple
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <StudioSheet
        title="Assets"
        description="Import screenshots, then click one to place it on the board, a slice, or a selected device."
        side="left"
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            variant="ghost"
            size="xs"
            title="Open assets"
            aria-label={
              assets.length === 0 ? "Open assets" : `Open assets, ${assets.length} imported`
            }
          >
            <Images />
            Assets
            {assets.length === 0 ? null : <span className="text-muted-foreground">{assets.length}</span>}
          </Button>
        }
      >
        <div
          className={cn(
            "rounded-xl border border-dashed p-3",
            dropping ? "border-primary/70 bg-primary/5" : "border-border",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            takeFiles(event.dataTransfer.files);
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {assets.length === 0 ? "Nothing imported yet." : `${assets.length} in the library.`}
            </p>
            <Button size="xs" variant="outline" onClick={() => input.current?.click()}>
              Import
            </Button>
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Drop PNG, JPEG, WebP, or SVG here. Click a thumbnail to fill the board, the selected
              slice, or a selected device screen.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    title={`Use ${asset.name}`}
                    className={cn(
                      "w-full overflow-hidden rounded-lg bg-popover text-left ring-1 ring-border hover:ring-muted-foreground",
                      asset.id === activeId && "ring-2 ring-primary",
                    )}
                    onClick={() => {
                      onPick(asset.id);
                      setOpen(false);
                    }}
                  >
                    <img src={asset.data} alt="" className="aspect-square w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-xs text-foreground" title={asset.name}>
                      {asset.name}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StudioSheet>
    </>
  );
}
