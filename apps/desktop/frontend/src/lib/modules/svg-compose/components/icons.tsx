import type { ReactNode } from "react";

const Glyph = ({ children }: { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height="18"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 24 24"
    width="18"
  >
    {children}
  </svg>
);

export const LogoIcon = () => (
  <Glyph>
    <rect height="7" rx="1.6" width="7" x="3" y="3" />
    <rect height="7" rx="1.6" width="7" x="14" y="3" />
    <rect height="7" rx="1.6" width="7" x="3" y="14" />
    <path d="M17.5 14v7M14 17.5h7" />
  </Glyph>
);

export const CursorIcon = () => (
  <Glyph>
    <path d="M5 3l6 18 2.4-7.6L21 11 5 3z" />
  </Glyph>
);

export const RectIcon = () => (
  <Glyph>
    <rect height="14" rx="2" width="16" x="4" y="5" />
  </Glyph>
);

export const EllipseIcon = () => (
  <Glyph>
    <ellipse cx="12" cy="12" rx="8" ry="7" />
  </Glyph>
);

export const LineIcon = () => (
  <Glyph>
    <path d="M5 19L19 5" />
  </Glyph>
);

export const PenIcon = () => (
  <Glyph>
    <path d="M12 3l7 7-10 10-5 1 1-5L15 6z" />
    <path d="M13 6l5 5" />
  </Glyph>
);

export const NodeIcon = () => (
  <Glyph>
    <path d="M7 7h10M7 17h10" />
    <rect fill="currentColor" height="4" rx="0.8" width="4" x="5" y="5" />
    <rect fill="currentColor" height="4" rx="0.8" width="4" x="15" y="15" />
  </Glyph>
);

export const UndoIcon = () => (
  <Glyph>
    <path d="M9 7H5V3" />
    <path d="M5.5 7A8 8 0 1 1 5 16" />
  </Glyph>
);

export const RedoIcon = () => (
  <Glyph>
    <path d="M15 7h4V3" />
    <path d="M18.5 7A8 8 0 1 0 19 16" />
  </Glyph>
);

export const FitIcon = () => (
  <Glyph>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Glyph>
);

export const GroupIcon = () => (
  <Glyph>
    <rect height="9" rx="1.5" width="9" x="3" y="3" />
    <rect height="9" rx="1.5" width="9" x="12" y="12" />
  </Glyph>
);

export const UngroupIcon = () => (
  <Glyph>
    <rect height="7" rx="1.5" width="7" x="3" y="3" />
    <rect height="7" rx="1.5" width="7" x="14" y="14" />
    <path d="M10 10l4-4M10 10l4 4" />
  </Glyph>
);

export const DetachIcon = () => (
  <Glyph>
    <rect height="12" rx="2" width="12" x="2" y="6" />
    <path d="M11 12h10m0 0l-4-4m4 4l-4 4" />
  </Glyph>
);

export const FrontIcon = () => (
  <Glyph>
    <rect height="7" rx="1" width="9" x="4" y="10" />
    <path d="M12 4h6v6M18 4l-5 5" />
  </Glyph>
);

export const BackIcon = () => (
  <Glyph>
    <rect height="7" rx="1" width="9" x="11" y="7" />
    <path d="M12 20H6v-6M6 20l5-5" />
  </Glyph>
);

export const UpIcon = () => (
  <Glyph>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Glyph>
);

export const DownIcon = () => (
  <Glyph>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Glyph>
);

export const AlignLeftIcon = () => (
  <Glyph>
    <path d="M4 3v18M8 6h11M8 12h7M8 18h11" />
  </Glyph>
);

export const AlignCenterIcon = () => (
  <Glyph>
    <path d="M12 3v18M6 6h12M8 12h8M6 18h12" />
  </Glyph>
);

export const AlignRightIcon = () => (
  <Glyph>
    <path d="M20 3v18M5 6h11M9 12h7M5 18h11" />
  </Glyph>
);

export const AlignTopIcon = () => (
  <Glyph>
    <path d="M3 4h18M6 8v11M12 8v7M18 8v11" />
  </Glyph>
);

export const AlignMiddleIcon = () => (
  <Glyph>
    <path d="M3 12h18M6 6v12M12 8v8M18 6v12" />
  </Glyph>
);

export const AlignBottomIcon = () => (
  <Glyph>
    <path d="M3 20h18M6 5v11M12 9v7M18 5v11" />
  </Glyph>
);

export const TrashIcon = () => (
  <Glyph>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    <path d="M10 11v5M14 11v5" />
  </Glyph>
);

export const CopyIcon = () => (
  <Glyph>
    <rect height="12" rx="2" width="12" x="8" y="8" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Glyph>
);

export const CornerIcon = () => (
  <Glyph>
    <path d="M5 19V11a6 6 0 0 1 6-6h8" />
    <circle cx="19" cy="5" fill="currentColor" r="1.6" stroke="none" />
  </Glyph>
);

export const ScaleIcon = () => (
  <Glyph>
    <path d="M14 4h6v6M20 4l-7 7" />
    <path d="M10 20H4v-6M4 20l7-7" />
  </Glyph>
);

export const RotateIcon = () => (
  <Glyph>
    <path d="M20 12a8 8 0 1 1-3-6.2" />
    <path d="M20 4v5h-5" />
  </Glyph>
);

export const TextIcon = () => (
  <Glyph>
    <path d="M5 6h14M12 6v13M9 19h6" />
  </Glyph>
);

export const FocusIcon = () => (
  <Glyph>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    <rect height="6" rx="1" width="6" x="9" y="9" />
  </Glyph>
);

export const RecenterIcon = () => (
  <Glyph>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </Glyph>
);

export const ImportIcon = () => (
  <Glyph>
    <path d="M12 3v11m0 0l-4-4m4 4l4-4" />
    <path d="M4 17v3h16v-3" />
  </Glyph>
);

export const ExportIcon = () => (
  <Glyph>
    <path d="M12 20V9m0 0l-4 4m4-4l4 4" />
    <path d="M4 5h16" />
  </Glyph>
);

export const ImageIcon = () => (
  <Glyph>
    <rect height="16" rx="2" width="18" x="3" y="4" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="M21 16l-5-5-6 7" />
  </Glyph>
);

export const HelpIcon = () => (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.2-1.5 1.6-1.5 3" />
    <circle cx="12" cy="17" fill="currentColor" r="0.7" stroke="none" />
  </Glyph>
);

export const ChevronLeftIcon = () => (
  <Glyph>
    <path d="M14 6l-6 6 6 6" />
  </Glyph>
);

export const ChevronRightIcon = () => (
  <Glyph>
    <path d="M10 6l6 6-6 6" />
  </Glyph>
);
