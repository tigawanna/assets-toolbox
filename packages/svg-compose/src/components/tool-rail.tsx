import type { ChangeEvent, ReactNode } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerIcon,
  CursorIcon,
  EllipseIcon,
  ExportIcon,
  FitIcon,
  FocusIcon,
  HelpIcon,
  ImageIcon,
  ImportIcon,
  LineIcon,
  LogoIcon,
  NodeIcon,
  PenIcon,
  RectIcon,
  RecenterIcon,
  RedoIcon,
  ScaleIcon,
  RotateIcon,
  TextIcon,
  UndoIcon,
} from "./icons";

type ToolRailProps = {
  tool: string | null;
  onTool: (id: string | null) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportFiles: (files: File[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onRecenter: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onShortcuts: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onScaleHint: () => void;
};

type ToolEntry = { id: string | null; label: string; key: string; icon: ReactNode };

const CREATE_TOOLS: ToolEntry[] = [
  { id: null, label: "Select", key: "V", icon: <CursorIcon /> },
  { id: "rect", label: "Rectangle", key: "R", icon: <RectIcon /> },
  { id: "ellipse", label: "Ellipse", key: "E", icon: <EllipseIcon /> },
  { id: "line", label: "Line", key: "L", icon: <LineIcon /> },
  { id: "pen", label: "Pen", key: "P", icon: <PenIcon /> },
  { id: "text", label: "Text", key: "T", icon: <TextIcon /> },
];

const TRANSFORM_TOOLS: ToolEntry[] = [
  { id: "node", label: "Node / morph", key: "N", icon: <NodeIcon /> },
  { id: "corner", label: "Morph corners", key: "K", icon: <CornerIcon /> },
  { id: "rotate", label: "Rotate", key: "O", icon: <RotateIcon /> },
];

type ButtonProps = {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  expanded: boolean;
  onClick: () => void;
};

function RailButton({ label, icon, shortcut, active, disabled, expanded, onClick }: ButtonProps) {
  const tip = shortcut ? `${label} · ${shortcut}` : label;
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`rail-button${active ? " active" : ""}`}
      data-tip={expanded ? undefined : tip}
      disabled={disabled}
      onClick={onClick}
      title={expanded ? undefined : tip}
    >
      <span className="rail-icon">{icon}</span>
      {expanded && (
        <>
          <span className="rail-label">{label}</span>
          {shortcut && <kbd className="rail-key">{shortcut}</kbd>}
        </>
      )}
    </button>
  );
}

export function ToolRail({
  tool,
  onTool,
  expanded,
  onToggleExpanded,
  canUndo,
  canRedo,
  onImportFiles,
  onUndo,
  onRedo,
  onFit,
  onRecenter,
  onExportSvg,
  onExportPng,
  onShortcuts,
  focusMode,
  onToggleFocus,
  onScaleHint,
}: ToolRailProps) {
  const pickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onImportFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <aside aria-label="Tools" className={`rail${expanded ? " expanded" : " collapsed"}`}>
      <div className="rail-brand">
        <span className="rail-brand-mark">
          <LogoIcon />
        </span>
        {expanded && <span className="rail-brand-name">SVG Compose</span>}
      </div>

      <div className="rail-body">
        <div className="rail-group">
          {expanded && <span className="rail-section-label">Create</span>}
          {CREATE_TOOLS.map((entry) => (
            <RailButton
              key={entry.label}
              label={entry.label}
              icon={entry.icon}
              shortcut={entry.key}
              active={tool === entry.id}
              expanded={expanded}
              onClick={() => onTool(entry.id)}
            />
          ))}
        </div>

        <div className="rail-group">
          {expanded && <span className="rail-section-label">Transform</span>}
          {TRANSFORM_TOOLS.map((entry) => (
            <RailButton
              key={entry.label}
              label={entry.label}
              icon={entry.icon}
              shortcut={entry.key}
              active={tool === entry.id}
              expanded={expanded}
              onClick={() => onTool(entry.id)}
            />
          ))}
          <RailButton
            label="Scale / stretch"
            icon={<ScaleIcon />}
            shortcut="S"
            active={false}
            expanded={expanded}
            onClick={onScaleHint}
          />
        </div>

        <div className="rail-group">
          <RailButton
            label="Undo"
            icon={<UndoIcon />}
            shortcut="⌘Z"
            disabled={!canUndo}
            expanded={expanded}
            onClick={onUndo}
          />
          <RailButton
            label="Redo"
            icon={<RedoIcon />}
            shortcut="⌘⇧Z"
            disabled={!canRedo}
            expanded={expanded}
            onClick={onRedo}
          />
          <RailButton
            label="Fit view"
            icon={<FitIcon />}
            shortcut="⌘0"
            expanded={expanded}
            onClick={onFit}
          />
          <RailButton
            label="Recenter"
            icon={<RecenterIcon />}
            shortcut="C"
            expanded={expanded}
            onClick={onRecenter}
          />
        </div>

        <div className="rail-group">
          <label
            aria-label="Import SVG"
            className="rail-button file-button"
            data-tip={expanded ? undefined : "Import SVG"}
            title={expanded ? undefined : "Import SVG"}
          >
            <span className="rail-icon">
              <ImportIcon />
            </span>
            {expanded && <span className="rail-label">Import SVG</span>}
            <input type="file" accept=".svg,image/svg+xml" multiple onChange={pickFiles} />
          </label>
          <RailButton
            label="Export SVG"
            icon={<ExportIcon />}
            expanded={expanded}
            onClick={onExportSvg}
          />
          <RailButton
            label="Export PNG"
            icon={<ImageIcon />}
            expanded={expanded}
            onClick={onExportPng}
          />
        </div>

        <div className="rail-spacer" />

        <div className="rail-group">
          <RailButton
            label="Focus mode"
            icon={<FocusIcon />}
            shortcut="\\"
            active={focusMode}
            expanded={expanded}
            onClick={onToggleFocus}
          />
          <RailButton
            label="Shortcuts"
            icon={<HelpIcon />}
            shortcut="⇧?"
            expanded={expanded}
            onClick={onShortcuts}
          />
        </div>
      </div>

      <button
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="rail-collapse"
        data-tip={expanded ? undefined : "Expand sidebar · Ctrl+B"}
        onClick={onToggleExpanded}
        title={`${expanded ? "Collapse" : "Expand"} sidebar · Ctrl+B`}
      >
        <span className="rail-icon">{expanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}</span>
        {expanded && <span className="rail-label">Collapse</span>}
      </button>
    </aside>
  );
}
