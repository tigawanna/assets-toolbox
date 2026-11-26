import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function StudioSheet({
  title,
  description,
  side = "left",
  trigger,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description: string;
  side?: "left" | "right";
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side={side}
        className="w-full gap-0 border-border bg-background p-0 text-foreground sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border bg-background/60 px-4 py-3 pr-12">
          <SheetTitle className="text-sm font-medium text-foreground">{title}</SheetTitle>
          <SheetDescription className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
