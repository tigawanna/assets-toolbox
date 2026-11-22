import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon: Icon,
  description,
  actions,
  fill = false,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  actions?: ReactNode;
  fill?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("flex min-h-0 flex-col border-b border-border/80", fill && "flex-1", className)}
    >
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/25 px-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon === undefined ? null : (
            <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-primary">
              <Icon className="size-3" aria-hidden />
            </span>
          )}
          <h2 className="truncate text-xs font-semibold tracking-widest text-foreground/90 uppercase">
            {title}
          </h2>
        </div>
        {actions}
      </header>
      {description === undefined ? null : (
        <p className="shrink-0 border-b border-border/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className={cn("min-h-0 overflow-auto px-3 py-3", fill && "flex-1", bodyClassName)}>
        {children}
      </div>
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
