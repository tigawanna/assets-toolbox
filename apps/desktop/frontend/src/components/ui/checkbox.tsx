import type { ComponentPropsWithoutRef } from "react";
import { Check } from "lucide-react";

import "./ui-controls.css";

export function Checkbox({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <span className={`ui-checkbox${className ? ` ${className}` : ""}`} data-slot="checkbox">
      <input className="ui-checkbox-input" type="checkbox" data-slot="checkbox-input" {...props} />
      <span className="ui-checkbox-box" aria-hidden="true">
        <Check size={11} strokeWidth={3} />
      </span>
    </span>
  );
}
