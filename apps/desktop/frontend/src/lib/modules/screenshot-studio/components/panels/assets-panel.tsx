import { Check, Images, Plus } from "lucide-react";
import { useState } from "react";

import { StudioSheet } from "@/components/studio-sheet";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/ui/file-dropzone";
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
  const [open, setOpen] = useState(false);

  return (
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
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          title="Open assets"
          aria-label={
            assets.length === 0 ? "Open assets" : `Open assets, ${assets.length} imported`
          }
        >
          <Images />
          Assets
          {assets.length === 0 ? null : (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary">
              {assets.length}
            </span>
          )}
        </Button>
      }
    >
      <div className="grid gap-4">
        <ImageDropzone
          onFiles={(files) => {
            for (const file of files) onImport(file);
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Library
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {assets.length} {assets.length === 1 ? "image" : "images"}
          </span>
        </div>
        {assets.length === 0 ? (
          <p className="rounded-lg border border-border/70 bg-background/25 p-3 text-xs leading-relaxed text-muted-foreground">
            Drop PNG, JPEG, WebP, or SVG above. Click a thumbnail to fill the board, the selected
            slice, or a selected device screen.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {assets.map((asset) => {
              const active = asset.id === activeId;
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    title={`Use ${asset.name}`}
                    className={cn(
                      "group w-full overflow-hidden rounded-lg bg-background/60 text-left ring-1 ring-border transition-all hover:ring-primary/60",
                      active && "ring-2 ring-primary",
                    )}
                    onClick={() => {
                      onPick(asset.id);
                      setOpen(false);
                    }}
                  >
                    <span className="relative block">
                      <img src={asset.data} alt="" className="aspect-square w-full object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {active ? (
                          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-4" aria-hidden />
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-1 text-xs font-medium text-background">
                            <Plus className="size-3" aria-hidden />
                            Use image
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className="block truncate px-2 py-1.5 text-xs text-foreground"
                      title={asset.name}
                    >
                      {asset.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </StudioSheet>
  );
}
