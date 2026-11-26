"use client";

import { ImagePlus, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function ImageDropzone({
  onFiles,
  multiple = true,
  compact = false,
  className,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(list: FileList | null) {
    if (list === null) return;
    const images = Array.from(list).filter(
      (file) => file.type.startsWith("image/") || file.name.endsWith(".svg"),
    );
    if (images.length > 0) onFiles(images);
  }

  function open() {
    input.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={compact ? "Upload an image" : "Drop images or browse files"}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files);
      }}
      className={cn(
        "group cursor-pointer rounded-lg border border-dashed text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        dragging
          ? "border-primary/80 bg-primary/10"
          : "border-border bg-background/40 hover:border-primary/50 hover:bg-primary/[0.04]",
        compact
          ? "flex items-center gap-2.5 px-3 py-2.5 text-left"
          : "grid place-items-center gap-2 px-4 py-7",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      {compact ? (
        <>
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary",
              dragging && "border-primary/60 text-primary",
            )}
          >
            <ImagePlus className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-foreground">
              {dragging ? "Drop to use image" : "Drop image or browse"}
            </span>
            <span className="block text-xs text-muted-foreground">PNG, JPG, WEBP or SVG</span>
          </span>
          <Upload className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        </>
      ) : (
        <>
          <span
            className={cn(
              "grid size-10 place-items-center rounded-lg border border-border/70 bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary",
              dragging && "border-primary/60 text-primary",
            )}
          >
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {dragging ? "Drop to import" : "Drop screenshots here"}
            </span>
            <span className="text-xs text-muted-foreground">or click to browse your files</span>
          </span>
          <span
            aria-hidden
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "pointer-events-none mt-1",
            )}
          >
            Browse files
          </span>
          <span className="text-xs tracking-wide text-muted-foreground/80 uppercase">
            PNG · JPG · WEBP · SVG
          </span>
        </>
      )}
    </div>
  );
}
