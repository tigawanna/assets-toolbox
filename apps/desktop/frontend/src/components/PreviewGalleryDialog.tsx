import { useEffect, useId, useRef, type JSX } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import "./preview-gallery.css";

export interface PreviewGalleryItem {
  title: string;
  src: string;
}

export interface PreviewGalleryDialogProps {
  items: PreviewGalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest("input, textarea, select, [role='textbox']") !== null;
}

export function PreviewGalleryDialog(props: PreviewGalleryDialogProps): JSX.Element {
  const { items, index, onIndexChange, onClose } = props;
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeHandlerRef = useRef(onClose);
  const indexHandlerRef = useRef(onIndexChange);
  const indexRef = useRef(0);
  const countRef = useRef(items.length);
  const stepRef = useRef<(delta: number) => void>(() => {});

  closeHandlerRef.current = onClose;
  indexHandlerRef.current = onIndexChange;
  countRef.current = items.length;

  const hasItems = items.length > 0;
  const safeIndex = hasItems ? Math.min(Math.max(index, 0), items.length - 1) : 0;
  const active = items[safeIndex];
  indexRef.current = safeIndex;

  function step(delta: number): void {
    const count = countRef.current;
    if (count === 0) return;
    const current = Math.min(Math.max(indexRef.current, 0), count - 1);
    indexHandlerRef.current((current + delta + count) % count);
  }
  stepRef.current = step;

  useEffect(() => {
    if (!hasItems) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKey(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }
      if (countRef.current === 0) return;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          stepRef.current(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          stepRef.current(1);
          break;
        case "Home":
          event.preventDefault();
          indexHandlerRef.current(0);
          break;
        case "End":
          event.preventDefault();
          indexHandlerRef.current(countRef.current - 1);
          break;
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [hasItems]);

  useEffect(() => {
    thumbRefs.current[safeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [safeIndex]);

  // React renders null as nothing while the public signature stays JSX.Element.
  if (!active) return null as unknown as JSX.Element;

  return createPortal(
    <div
      className="preview-gallery-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="preview-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <header className="preview-gallery-header">
          <div className="preview-gallery-heading">
            <div className="preview-gallery-heading-top">
              <span className="preview-gallery-eyebrow">Preview</span>
              <span className="preview-gallery-count">
                {safeIndex + 1} / {items.length}
              </span>
            </div>
            <strong id={headingId} className="preview-gallery-title">
              {active.title}
            </strong>
          </div>
          <div className="preview-gallery-actions">
            {props.actionLabel ? (
              <button
                type="button"
                className="preview-gallery-action"
                onClick={() => {
                  onClose();
                  props.onAction?.();
                }}
              >
                {props.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="preview-gallery-icon-button"
              aria-label="Previous image"
              title="Previous image (Left arrow)"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="preview-gallery-icon-button"
              aria-label="Next image"
              title="Next image (Right arrow)"
              onClick={() => step(1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="preview-gallery-icon-button preview-gallery-close"
              aria-label="Close preview"
              title="Close preview (Escape)"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="preview-gallery-stage">
          <img src={active.src} alt={active.title} />
        </div>

        <div className="preview-gallery-strip" role="group" aria-label="Gallery images">
          {items.map((item, itemIndex) => (
            <button
              key={`${item.src}-${itemIndex}`}
              ref={(node) => {
                thumbRefs.current[itemIndex] = node;
              }}
              type="button"
              className={`preview-gallery-thumb${itemIndex === safeIndex ? " preview-gallery-thumb-active" : ""}`}
              aria-label={`Show ${item.title}`}
              aria-pressed={itemIndex === safeIndex}
              onClick={() => onIndexChange(itemIndex)}
            >
              <img src={item.src} alt="" />
              <span className="preview-gallery-thumb-title">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
