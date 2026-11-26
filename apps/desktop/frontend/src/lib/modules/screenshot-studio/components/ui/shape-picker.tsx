"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHAPE_KINDS, type ShapeKind } from "@/lib/studio";
import { cn } from "@/lib/utils";

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: "Rectangle",
  rounded: "Rounded",
  pill: "Pill",
  ellipse: "Ellipse",
  triangle: "Triangle",
  star: "Star",
};

export function ShapeGlyph({ kind }: { kind: ShapeKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      {kind === "rect" ? <rect x="4" y="6" width="16" height="12" rx="0.5" /> : null}
      {kind === "rounded" ? <rect x="4" y="6" width="16" height="12" rx="3" /> : null}
      {kind === "pill" ? <rect x="3" y="8" width="18" height="8" rx="4" /> : null}
      {kind === "ellipse" ? <ellipse cx="12" cy="12" rx="9" ry="7" /> : null}
      {kind === "triangle" ? <polygon points="12,4 21,20 3,20" /> : null}
      {kind === "star" ? (
        <polygon points="12,3 14.7,9.1 21.4,9.7 16.3,14.1 17.9,20.7 12,17.2 6.1,20.7 7.7,14.1 2.6,9.7 9.3,9.1" />
      ) : null}
    </svg>
  );
}

export function ShapeOptionGrid({
  value,
  onSelect,
}: {
  value?: ShapeKind;
  onSelect: (shape: ShapeKind) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHAPE_KINDS.map((kind) => {
        const selected = kind === value;
        return (
          <button
            key={kind}
            type="button"
            title={SHAPE_LABELS[kind]}
            aria-label={SHAPE_LABELS[kind]}
            aria-pressed={selected}
            onClick={() => onSelect(kind)}
            className={cn(
              "grid place-items-center gap-1 rounded-md border border-border/70 bg-background/40 py-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary",
              selected && "border-primary/70 bg-primary/10 text-primary",
            )}
          >
            <ShapeGlyph kind={kind} />
            <span className="text-xs">{SHAPE_LABELS[kind]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ShapePicker({
  value,
  onChange,
}: {
  value: ShapeKind;
  onChange: (shape: ShapeKind) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Shape: ${SHAPE_LABELS[value]}`}
          className="group h-9 w-full justify-start gap-2.5 bg-background/60 px-2.5 font-normal"
        >
          <ShapeGlyph kind={value} />
          <span className="text-xs text-foreground">{SHAPE_LABELS[value]}</span>
          <ChevronDown className="ml-auto size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="grid gap-3">
          <Label className="text-xs">Shape</Label>
          <ShapeOptionGrid
            value={value}
            onSelect={(shape) => {
              onChange(shape);
              setOpen(false);
            }}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Applies to the fill or image. Drag any anchor to resize freely.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
