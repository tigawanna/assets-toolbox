"use client";

import { Check, ChevronDown, Pipette } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "#0d0f0e",
  "#1c221e",
  "#2a332c",
  "#46584a",
  "#7d947d",
  "#b9cbb4",
  "#eef1ec",
  "#ffffff",
  "#bef264",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#f472b6",
  "#facc15",
  "#fb923c",
  "#ef4444",
  "#be123c",
  "#92400e",
  "#78350f",
  "#451a03",
  "#000000",
];

function normalizeHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#2a332c";
}

export function ColorPicker({
  value,
  onChange,
  label = "Color",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const color = normalizeHex(value);
  const hexId = useId();
  const [draft, setDraft] = useState(color.toUpperCase());

  useEffect(() => {
    setDraft((current) =>
      current.toLowerCase() === color.toLowerCase() ? current : color.toUpperCase(),
    );
  }, [color]);

  function commitDraft(next: string) {
    const raw = next.startsWith("#") ? next : `#${next}`;
    setDraft(raw.toUpperCase());
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw.toLowerCase());
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${label}: ${color}`}
          className={cn(
            "group h-9 w-full justify-start gap-2.5 bg-background/60 px-2.5 font-normal",
            className,
          )}
        >
          <span
            aria-hidden
            className="size-4 shrink-0 rounded-[5px] border border-white/20 shadow-inner ring-1 ring-black/50"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs tracking-wide uppercase text-foreground">{color}</span>
          <ChevronDown className="ml-auto size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={hexId} className="text-xs">
              {label}
            </Label>
            <span className="text-xs tracking-wide text-muted-foreground uppercase">Hex</span>
          </div>
          <div className="flex items-center gap-2">
            <label
              className="relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-border bg-background/60 transition-colors hover:border-primary/60"
              title="Pick a custom color"
            >
              <Pipette className="size-4 text-muted-foreground" aria-hidden />
              <input
                type="color"
                aria-label="Pick a custom color"
                value={color}
                onChange={(event) => onChange(event.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <Input
              id={hexId}
              value={draft}
              spellCheck={false}
              maxLength={7}
              onChange={(event) => commitDraft(event.target.value)}
              onBlur={() => setDraft(color.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              className="h-9 font-mono text-xs uppercase"
            />
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {SWATCHES.map((swatch) => {
              const selected = swatch === color;
              return (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  aria-label={`Use ${swatch}`}
                  aria-pressed={selected}
                  onClick={() => onChange(swatch)}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md ring-1 ring-inset ring-white/10 transition-transform hover:scale-110",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-popover",
                  )}
                  style={{ backgroundColor: swatch }}
                >
                  {selected ? (
                    <Check
                      className={cn(
                        "size-3 drop-shadow",
                        ["#ffffff", "#eef1ec", "#b9cbb4", "#bef264", "#facc15"].includes(swatch)
                          ? "text-black/80"
                          : "text-white",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Click a swatch, enter a hex value, or use the picker for any color.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
