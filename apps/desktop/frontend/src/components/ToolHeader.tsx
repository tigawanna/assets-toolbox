import * as React from "react";

import "./tool-header.css";

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------------------------------
 * ToolHeader
 *
 * A compound, shadcn-style header shared by every tool. It accepts the common
 * icon / title / description / actions shape directly, and also exposes parts
 * for composing more bespoke headers without ever re-inventing the layout:
 *
 *   <ToolHeader icon={...} title="..." description="..." actions={...} />
 *
 *   <ToolHeader>
 *     <ToolHeaderBrand icon={...} title="..." description="..." />
 *     <ToolHeaderActions>
 *       <ToolHeaderButton variant="primary">Generate</ToolHeaderButton>
 *     </ToolHeaderActions>
 *   </ToolHeader>
 * ----------------------------------------------------------------------------------------------- */

export interface ToolHeaderProps extends Omit<React.ComponentPropsWithoutRef<"header">, "title"> {
  /** Leading icon, normally a `PackageIcon`. */
  icon?: React.ReactNode;
  /** Tool name. */
  title: React.ReactNode;
  /** Short status line below the title. `meta` is kept as an alias. */
  description?: React.ReactNode;
  meta?: React.ReactNode;
  /** Right-aligned controls. */
  actions?: React.ReactNode;
}

export const ToolHeader = React.forwardRef<HTMLElement, ToolHeaderProps>(function ToolHeader(
  { icon, title, description, meta, actions, children, className, ...props },
  ref,
) {
  return (
    <header ref={ref} data-slot="tool-header" className={cn("tool-header", className)} {...props}>
      {children ?? (
        <>
          <ToolHeaderBrand icon={icon} title={title} description={description ?? meta} />
          {actions ? <ToolHeaderActions>{actions}</ToolHeaderActions> : null}
        </>
      )}
    </header>
  );
});

/* -------------------------------------------------------------------------------------------------
 * ToolHeaderBrand
 * ----------------------------------------------------------------------------------------------- */

export interface ToolHeaderBrandProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}

export function ToolHeaderBrand({
  icon,
  title,
  description,
  className,
  children,
  ...props
}: ToolHeaderBrandProps) {
  return (
    <div data-slot="tool-header-brand" className={cn("tool-header-brand", className)} {...props}>
      {children ?? (
        <>
          {icon ? <ToolHeaderIcon>{icon}</ToolHeaderIcon> : null}
          <div data-slot="tool-header-copy" className="tool-header-copy">
            <ToolHeaderTitle>{title}</ToolHeaderTitle>
            {description ? <ToolHeaderDescription>{description}</ToolHeaderDescription> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function ToolHeaderIcon({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="tool-header-icon"
      aria-hidden="true"
      className={cn("tool-header-icon", className)}
      {...props}
    />
  );
}

export function ToolHeaderTitle({ className, ...props }: React.ComponentPropsWithoutRef<"strong">) {
  return (
    <strong
      data-slot="tool-header-title"
      className={cn("tool-header-title", className)}
      {...props}
    />
  );
}

export function ToolHeaderDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="tool-header-description"
      className={cn("tool-header-description", className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * ToolHeaderActions / ToolHeaderButton
 * ----------------------------------------------------------------------------------------------- */

export function ToolHeaderActions({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="tool-header-actions"
      className={cn("tool-header-actions", className)}
      {...props}
    />
  );
}

export type ToolHeaderButtonVariant = "default" | "primary" | "ghost" | "icon";

export interface ToolHeaderButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: ToolHeaderButtonVariant;
}

export function ToolHeaderButton({
  variant = "default",
  className,
  type = "button",
  ...props
}: ToolHeaderButtonProps) {
  return (
    <button
      data-slot="tool-header-button"
      data-variant={variant}
      type={type}
      className={cn("tool-header-button", `tool-header-button-${variant}`, className)}
      {...props}
    />
  );
}
