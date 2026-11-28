"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon: Icon,
  description,
  actions,
  fill = false,
  collapsible = true,
  defaultOpen = true,
  className,
  bodyClassName,
  dataTour,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  actions?: ReactNode;
  fill?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  dataTour?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  const heading = (
    <>
      {Icon === undefined ? null : (
        <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-primary">
          <Icon className="size-3" aria-hidden />
        </span>
      )}
      <span className="truncate text-xs font-semibold tracking-widest text-foreground/90 uppercase">
        {title}
      </span>
    </>
  );

  return (
    <section
      data-tour={dataTour}
      className={cn(
        "flex min-h-0 flex-col border-b border-border/80",
        fill && open && "flex-1",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border/60 bg-background/25 px-2.5">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((current) => !current)}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {heading}
            <ChevronDown
              className={cn(
                "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 px-0.5">{heading}</div>
        )}
        {actions}
      </div>
      {open ? (
        <div id={bodyId} className="flex min-h-0 flex-col">
          {description === undefined ? null : (
            <p className="shrink-0 border-b border-border/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          <div className={cn("min-h-0 overflow-auto px-3 py-3", fill && "flex-1", bodyClassName)}>
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SectionLabel({
  children,
  count,
  className,
}: {
  children: ReactNode;
  count?: number | string;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center gap-2", className)}>
      <p className="shrink-0 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {children}
      </p>
      <span className="h-px flex-1 bg-border/70" aria-hidden />
      {count === undefined ? null : (
        <span className="rounded bg-muted/70 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  className,
  bodyClassName,
  dataTour,
  children,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  dataTour?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section data-tour={dataTour} className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
        className="group flex w-full items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <span className="shrink-0 text-xs font-semibold tracking-widest text-muted-foreground uppercase group-hover:text-foreground">
          {title}
        </span>
        <span className="h-px flex-1 bg-border/70" aria-hidden />
        {count === undefined ? null : (
          <span className="rounded bg-muted/70 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </button>
      {open ? (
        <div id={bodyId} className={cn("mt-2 grid gap-2", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
