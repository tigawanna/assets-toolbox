import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { ImageDropzone } from "@/components/ui/file-dropzone";
import { Label } from "@/components/ui/label";
import type { AssetRow } from "@/lib/studio";
import { cn } from "@/lib/utils";

export function FillPicker({
  label,
  color,
  imageId,
  assets,
  onColor,
  onPickAsset,
  onImport,
  onClearImage,
}: {
  label: string;
  color: string;
  imageId?: string;
  assets: AssetRow[];
  onColor: (color: string) => void;
  onPickAsset: (id: string) => void;
  onImport: (file: File) => void;
  onClearImage: () => void;
}) {
  const current = assets.find((asset) => asset.id === imageId);
  const hasImage = imageId !== undefined && imageId !== "";

  return (
    <div className="grid gap-3">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        <div className="grid gap-3 rounded-lg border border-border/70 bg-background/25 p-2.5">
          <div className="grid gap-1.5">
            <Label className="text-xs">Color</Label>
            <ColorPicker value={color} onChange={onColor} label={`${label} color`} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Image</Label>
            <ImageDropzone
              compact
              onFiles={(files) => {
                const file = files[0];
                if (file !== undefined) onImport(file);
              }}
            />
          </div>
          {current === undefined ? null : (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-1.5">
              <img
                src={current.data}
                alt=""
                className="size-8 shrink-0 rounded object-cover ring-1 ring-border"
              />
              <span
                className="min-w-0 flex-1 truncate text-xs text-foreground"
                title={current.name}
              >
                {current.name}
              </span>
              {hasImage ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Clear image"
                  aria-label="Clear image"
                  onClick={onClearImage}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {assets.length === 0 ? null : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              From library
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">{assets.length}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {assets.map((asset) => {
              const selected = asset.id === imageId;
              return (
                <button
                  key={asset.id}
                  type="button"
                  title={asset.name}
                  aria-pressed={selected}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-md bg-background ring-1 ring-border transition-all hover:ring-muted-foreground",
                    selected && "ring-2 ring-primary ring-offset-1 ring-offset-popover",
                  )}
                  onClick={() => onPickAsset(asset.id)}
                >
                  <img src={asset.data} alt={asset.name} className="size-full object-cover" />
                  {selected ? (
                    <span className="absolute right-0.5 bottom-0.5 grid size-3.5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" aria-hidden />
                    </span>
                  ) : null}
                  <span className="sr-only">{asset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
