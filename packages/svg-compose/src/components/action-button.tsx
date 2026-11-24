import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  hint: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onHover: (hint: string | null) => void;
};

/** Rail-style action row: icon, label, shortcut badge, hover description. */
export function ActionButton({
  label,
  icon,
  hint,
  shortcut,
  danger,
  disabled,
  onClick,
  onHover,
}: Props) {
  return (
    <button
      className={`action-button${danger ? " danger" : ""}`}
      disabled={disabled}
      title={hint}
      onClick={onClick}
      onMouseEnter={() => onHover(hint)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(hint)}
      onBlur={() => onHover(null)}
    >
      <span className="action-icon">{icon}</span>
      <span className="action-label">{label}</span>
      {shortcut && <kbd className="action-key">{shortcut}</kbd>}
    </button>
  );
}
