import { useEffect, useId, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

export interface AssetPreviewItem {
  src: string;
  label: string;
  sub?: string;
  meta?: string;
}

interface AssetPreviewGalleryProps {
  items: AssetPreviewItem[];
  emptyMessage?: string;
}

export function AssetPreviewGallery({
  items,
  emptyMessage = "No share assets were declared by this page.",
}: AssetPreviewGalleryProps): JSX.Element {
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const active = items[Math.min(selected, Math.max(0, items.length - 1))] ?? null;

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useEffect(() => {
    if (!expanded) return;
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expanded]);

  if (!active) {
    return <p className="inspect-empty-copy">{emptyMessage}</p>;
  }

  return (
    <div className="inspect-gallery">
      <div className="inspect-gallery-stage">
        <button
          type="button"
          className="inspect-gallery-image"
          onClick={() => setExpanded(true)}
          aria-label={`Enlarge ${active.label}`}
        >
          <img src={active.src} alt={active.label} />
          <span className="inspect-gallery-expand">Click to enlarge</span>
        </button>
      </div>

      <div className="inspect-gallery-detail">
        <span className="inspect-panel-label">Selected asset</span>
        <strong>{active.label}</strong>
        {active.sub ? <span className="inspect-gallery-sub">{active.sub}</span> : null}
        {active.meta ? <span className="inspect-gallery-meta">{active.meta}</span> : null}
        <a href={active.src} target="_blank" rel="noreferrer" className="inspect-gallery-open">
          Open source ↗
        </a>
      </div>

      <div className="inspect-gallery-strip" aria-label="Share assets">
        {items.map((item, index) => (
          <button
            key={`${item.src}-${index}`}
            type="button"
            className={`inspect-gallery-thumb${item === active ? " selected" : ""}`}
            onClick={() => setSelected(index)}
            aria-label={`Show ${item.label}`}
            aria-pressed={item === active}
          >
            <img src={item.src} alt="" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {expanded
        ? createPortal(
            <div
              className="inspect-gallery-backdrop"
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) setExpanded(false);
              }}
            >
              <div
                className="inspect-gallery-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
              >
                <header>
                  <div>
                    <span>Preview</span>
                    <strong id={headingId}>{active.label}</strong>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    className="inspect-gallery-close"
                    aria-label="Close preview"
                    onClick={() => setExpanded(false)}
                  >
                    ×
                  </button>
                </header>
                <div className="inspect-gallery-dialog-stage">
                  <img src={active.src} alt={active.label} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
