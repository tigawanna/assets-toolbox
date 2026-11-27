import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "lucide-react";

import "./ui-controls.css";

export interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "children"> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <span className={`ui-select${className ? ` ${className}` : ""}`} data-slot="select">
      <select className="ui-select-native" data-slot="select-native" {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="ui-select-chevron" aria-hidden="true" />
    </span>
  );
}
