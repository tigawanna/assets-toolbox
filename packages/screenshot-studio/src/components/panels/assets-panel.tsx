import { Check, ChevronLeft, ChevronRight, Eye, Images, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (previewIndex === null) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewIndex(null);
      else if (event.key === "ArrowLeft")
        setPreviewIndex((index) =>
          index === null ? null : (index - 1 + assets.length) % assets.length,
        );
      else if (event.key === "ArrowRight")
        setPreviewIndex((index) => (index === null ? null : (index + 1) % assets.length));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [assets.length, previewIndex]);

  return (
    <>
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
              {assets.map((asset, index) => {
                const active = asset.id === activeId;
                return (
                  <li key={asset.id} className="relative">
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
                        <img
                          src={asset.data}
                          alt=""
                          className="aspect-square w-full object-cover"
                        />
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
                    <button
                      type="button"
                      aria-label={`Preview ${asset.name}`}
                      title={`Preview ${asset.name}`}
                      className="absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-md bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => setPreviewIndex(index)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </StudioSheet>
      {previewIndex !== null && assets[previewIndex]
        ? createPortal(
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
              role="presentation"
              onClick={() => setPreviewIndex(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Preview ${assets[previewIndex].name}`}
                className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="truncate text-xs font-medium text-foreground">
                    {assets[previewIndex].name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Previous image"
                      onClick={() =>
                        setPreviewIndex((index) =>
                          index === null ? null : (index - 1 + assets.length) % assets.length,
                        )
                      }
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Next image"
                      onClick={() =>
                        setPreviewIndex((index) =>
                          index === null ? null : (index + 1) % assets.length,
                        )
                      }
                    >
                      <ChevronRight />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Close preview"
                      onClick={() => setPreviewIndex(null)}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
                <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-muted/30 p-6">
                  <img
                    src={assets[previewIndex].data}
                    alt={assets[previewIndex].name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
