import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** The Screenshot Studio mark, mirroring assets/icon.svg and public/favicon.svg. */
export function ScreenshotStudioIcon({
  className,
  title = "Screenshot Studio",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("size-5 shrink-0 text-primary", className)}
      {...props}
    >
      <rect width="64" height="64" rx="16" fill="currentColor" fillOpacity="0.12" />
      <rect
        x="19"
        y="7"
        width="26"
        height="50"
        rx="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <rect x="24" y="14" width="16" height="36" rx="3" fill="currentColor" fillOpacity="0.16" />
      <circle cx="36" cy="24" r="2" fill="currentColor" />
      <path
        d="M26 41l4-7 3 4 3-4 4 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
