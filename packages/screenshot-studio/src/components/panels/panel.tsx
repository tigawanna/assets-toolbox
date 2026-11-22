import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  actions,
  fill = false,
  children,
}: {
  title: string;
  actions?: ReactNode;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col border-b border-border", fill && "flex-1")}>
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {actions}
      </header>
      <div className={cn("min-h-0 overflow-auto px-3 pb-3", fill && "flex-1")}>{children}</div>
    </section>
  );
}
