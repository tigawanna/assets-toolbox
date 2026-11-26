import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "./asset-controls.css";

interface AssetPreviewDialogProps {
  title: string;
  src?: string;
  onClose: () => void;
}

export function AssetPreviewDialog({ title, src, onClose }: AssetPreviewDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!src) return;
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, src]);

  if (!src) return null;

  return createPortal(
    <div
      className="asset-lightbox-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="asset-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} preview`}
      >
        <header>
          <div>
            <span>Preview</span>
            <strong>{title}</strong>
          </div>
          <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="asset-lightbox-stage">
          <img src={src} alt={title} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
