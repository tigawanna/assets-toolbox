import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssetRow } from "@/lib/studio";

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
  const input = useRef<HTMLInputElement>(null);
  const current = assets.find((asset) => asset.id === imageId);
  return (
    <div className="grid gap-2">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Color
        <Input
          type="color"
          value={color.startsWith("#") && color.length === 7 ? color : "#2a332c"}
          className="h-8 border-border bg-background"
          onChange={(event) => onColor(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <Button size="xs" variant="outline" onClick={() => input.current?.click()}>
          Upload image
        </Button>
        {imageId === undefined || imageId === "" ? null : (
          <Button size="xs" variant="ghost" onClick={onClearImage}>
            Clear image
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onImport(file);
          event.target.value = "";
        }}
      />
      {current === undefined ? null : (
        <p className="truncate text-xs text-muted-foreground">Using {current.name}</p>
      )}
      {assets.length === 0 ? null : (
        <div className="grid grid-cols-4 gap-1">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              title={asset.name}
              className={
                asset.id === imageId
                  ? "overflow-hidden rounded-md ring-2 ring-primary"
                  : "overflow-hidden rounded-md ring-1 ring-border hover:ring-muted-foreground"
              }
              onClick={() => onPickAsset(asset.id)}
            >
              <img src={asset.data} alt={asset.name} className="h-12 w-full object-cover" />
            </button>
          ))}
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
