import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  hint: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/** Rail-style action row: icon, label, shortcut badge, native title tooltip. */
export function ActionButton({ label, icon, hint, shortcut, danger, disabled, onClick }: Props) {
  return (
    <button
      className={`action-button${danger ? " danger" : ""}`}
      disabled={disabled}
      title={hint}
      onClick={onClick}
    >
      <span className="action-icon">{icon}</span>
      <span className="action-label">{label}</span>
      {shortcut && <kbd className="action-key">{shortcut}</kbd>}
    </button>
  );
}
