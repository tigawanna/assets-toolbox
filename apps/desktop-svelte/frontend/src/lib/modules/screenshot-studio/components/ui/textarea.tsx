import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background/60 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex field-sizing-content min-h-16 w-full resize-none rounded-md border px-2.5 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
