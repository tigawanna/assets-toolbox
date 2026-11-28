import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import type { ToolRoute } from "../lib/catalog";

type ShellLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: ToolRoute | "/" | "/mcp" | "/help" | "/settings";
  children: ReactNode;
};

export function ShellLink({ to, children, ...props }: ShellLinkProps) {
  return (
    <Link to={to} {...props}>
      {children}
    </Link>
  );
}
