import { useEffect, useId, useRef, type JSX } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "./shortcuts-dialog.css";

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: "Everywhere",
    shortcuts: [
      { keys: ["?"], label: "Show this shortcut list" },
      { keys: ["Esc"], label: "Close the current dialog or search" },
      { keys: ["Ctrl", "B"], label: "Collapse or expand the sidebar" },
    ],
  },
  {
    title: "Projects",
    shortcuts: [
      { keys: ["Enter"], label: "Create project from the new-project dialog" },
      { keys: ["Esc"], label: "Cancel the new-project dialog" },
      { keys: ["←", "→"], label: "Move through the asset gallery" },
      { keys: ["Home", "End"], label: "First or last asset in the gallery" },
    ],
  },
  {
    title: "Icon Compose",
    shortcuts: [
      { keys: ["V"], label: "Select tool" },
      { keys: ["R"], label: "Rectangle" },
      { keys: ["E"], label: "Ellipse" },
      { keys: ["L"], label: "Line" },
      { keys: ["P"], label: "Pen" },
      { keys: ["N"], label: "Node / morph" },
      { keys: ["T"], label: "Text" },
      { keys: ["K"], label: "Morph corners" },
      { keys: ["O"], label: "Rotate" },
      { keys: ["S"], label: "Scale / stretch" },
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "G"], label: "Group selection" },
      { keys: ["Ctrl", "Shift", "G"], label: "Ungroup selection" },
      { keys: ["Ctrl", "D"], label: "Duplicate selection" },
      { keys: ["Ctrl", "0"], label: "Fit document to view" },
      { keys: ["C"], label: "Recenter view" },
      { keys: ["["], label: "Toggle tool rail" },
      { keys: ["]"], label: "Toggle inspector" },
      { keys: ["\\"], label: "Focus mode" },
      { keys: ["Del"], label: "Delete selection" },
    ],
  },
  {
    title: "Sound board",
    shortcuts: [
      { keys: ["/"], label: "Focus the sound search" },
      { keys: ["Esc"], label: "Clear the search" },
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return createPortal(
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shortcuts-header">
          <div>
            <span>Keyboard</span>
            <strong id={headingId}>Shortcuts</strong>
          </div>
          <button ref={closeRef} type="button" aria-label="Close shortcuts" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="shortcuts-body">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <div className="shortcuts-list">
                {section.shortcuts.map((shortcut) => (
                  <div className="shortcuts-row" key={shortcut.label}>
                    <span>{shortcut.label}</span>
                    <span className="shortcuts-keys">
                      {shortcut.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
