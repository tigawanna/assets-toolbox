import { useEffect } from "react";

type Shortcut = { label: string; keys: string[] };
type Section = { title: string; shortcuts: Shortcut[] };

const SECTIONS: Section[] = [
  {
    title: "General",
    shortcuts: [
      { label: "Show keyboard shortcuts", keys: ["Shift", "?"] },
      { label: "Close dialog", keys: ["Esc"] },
      { label: "Undo", keys: ["Ctrl", "Z"] },
      { label: "Redo", keys: ["Ctrl", "Shift", "Z"] },
      { label: "Fit drawing to view", keys: ["Ctrl", "0"] },
      { label: "Recenter on selection", keys: ["C"] },
    ],
  },
  {
    title: "Tools",
    shortcuts: [
      { label: "Selector", keys: ["V"] },
      { label: "Node", keys: ["N"] },
      { label: "Rectangle", keys: ["R"] },
      { label: "Ellipse", keys: ["E"] },
      { label: "Line", keys: ["L"] },
      { label: "Pen / Bezier", keys: ["P"] },
      { label: "Text", keys: ["T"] },
      { label: "Corner radius", keys: ["K"] },
      { label: "Rotate", keys: ["O"] },
      { label: "Scale / stretch", keys: ["S"] },
      { label: "Object to path", keys: ["Ctrl", "Shift", "C"] },
      { label: "Toggle tool rail", keys: ["Ctrl", "B"] },
      { label: "Toggle inspector", keys: ["]"] },
      { label: "Focus mode (hide both)", keys: ["\\"] },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { label: "Select inside a group", keys: ["Ctrl", "Click"] },
      { label: "Enter a group", keys: ["Double-click"] },
      { label: "Add to selection", keys: ["Shift", "Click"] },
      { label: "Select object underneath", keys: ["Alt", "Click"] },
      { label: "Scale from a corner box", keys: ["Shift", "Drag"] },
      { label: "Rotate from the top handle", keys: ["Drag"] },
      { label: "Delete selection", keys: ["Del"] },
      { label: "Duplicate selection", keys: ["Ctrl", "D"] },
      { label: "Smooth / corner node", keys: ["S"] },
      { label: "Delete focused node", keys: ["Del"] },
    ],
  },
  {
    title: "Arrange",
    shortcuts: [
      { label: "Group", keys: ["Ctrl", "G"] },
      { label: "Ungroup", keys: ["Ctrl", "Shift", "G"] },
      { label: "Pan the canvas", keys: ["Space", "Drag"] },
      { label: "Zoom in and out", keys: ["Wheel"] },
    ],
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ShortcutsDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h1>Keyboard shortcuts</h1>
        <div className="shortcuts-grid">
          {SECTIONS.map((section) => (
            <section key={section.title} className="shortcuts-section">
              <h2>{section.title}</h2>
              <ul>
                {section.shortcuts.map((shortcut) => (
                  <li key={shortcut.label}>
                    <span className="shortcut-label">{shortcut.label}</span>
                    <span className="shortcut-keys">
                      {shortcut.keys.map((key, index) => (
                        <kbd key={`${key}-${index}`}>{key}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="modal-footer">
          <button className="button primary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export const isShortcutHelp = (event: KeyboardEvent) =>
  event.key === "?" || (event.shiftKey && event.key === "/");
