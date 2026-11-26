import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Circle,
  Download,
  ImagePlus,
  Square,
  Trash2,
  Type,
  X,
} from "lucide-react";

import "../modules/brand-assets/og-editor.css";

export interface OgDesignResult {
  dataUrl: string;
  width: number;
  height: number;
}

export interface OgVisualEditorProps {
  title?: string;
  description?: string;
  siteLabel?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  onExport: (result: OgDesignResult) => void;
  onClose: () => void;
}

type TextAlign = "left" | "center" | "right";

interface LayerBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
  align: TextAlign;
}

interface ShapeLayer extends LayerBase {
  kind: "rect" | "ellipse";
  fill: string;
  fillImage?: string;
  radius: number;
}

interface ImageLayer extends LayerBase {
  kind: "image";
  src: string;
}

type Layer = TextLayer | ShapeLayer | ImageLayer;

interface LayerPatch {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  color?: string;
  align?: TextAlign;
  fill?: string;
  fillImage?: string;
  radius?: number;
  src?: string;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

type StyleVars = CSSProperties & Record<`--${string}`, string>;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif';
const ACCENT_FILL = "#b65e37";
const SOFT_FILL = "#efa77f";

let layerSequence = 0;

function makeLayerId(): string {
  layerSequence += 1;
  return `og-layer-${layerSequence}`;
}

function dimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.round(value ?? fallback) : fallback;
}

function createInitialLayers(
  props: OgVisualEditorProps,
  designWidth: number,
  designHeight: number,
): Layer[] {
  const inset = Math.max(24, Math.round(designWidth * 0.06));
  const hasImage = Boolean(props.imageUrl);
  const contentWidth = hasImage ? Math.round(designWidth * 0.55) : designWidth - inset * 2;
  const layers: Layer[] = [
    {
      id: makeLayerId(),
      kind: "rect",
      name: "Background",
      x: 0,
      y: 0,
      width: designWidth,
      height: designHeight,
      fill: "#121612",
      radius: 0,
    },
    {
      id: makeLayerId(),
      kind: "text",
      name: "Site label",
      x: inset,
      y: Math.round(designHeight * 0.12),
      width: contentWidth,
      height: Math.round(designHeight * 0.08),
      text: props.siteLabel?.trim() || "PROJECT",
      fontSize: Math.max(14, Math.round(designWidth * 0.022)),
      fontWeight: 600,
      lineHeight: 1.2,
      color: "#efa77f",
      align: "left",
    },
    {
      id: makeLayerId(),
      kind: "text",
      name: "Headline",
      x: inset,
      y: Math.round(designHeight * 0.42),
      width: contentWidth,
      height: Math.round(designHeight * 0.34),
      text: props.title?.trim() || "Your headline",
      fontSize: Math.max(28, Math.round(designWidth * 0.064)),
      fontWeight: 700,
      lineHeight: 1.05,
      color: "#f3f1e9",
      align: "left",
    },
  ];

  if (props.description?.trim()) {
    layers.push({
      id: makeLayerId(),
      kind: "text",
      name: "Description",
      x: inset,
      y: Math.round(designHeight * 0.76),
      width: contentWidth,
      height: Math.round(designHeight * 0.16),
      text: props.description.trim(),
      fontSize: Math.max(16, Math.round(designWidth * 0.025)),
      fontWeight: 400,
      lineHeight: 1.3,
      color: "#b8bdb2",
      align: "left",
    });
  }

  if (props.imageUrl) {
    layers.push({
      id: makeLayerId(),
      kind: "image",
      name: "Image",
      x: Math.round(designWidth * 0.64),
      y: Math.round(designHeight * 0.12),
      width: Math.round(designWidth * 0.3),
      height: Math.round(designHeight * 0.5),
      src: props.imageUrl,
    });
  }

  return layers;
}

function normalizeHex(value: string, fallback = "#000000"): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  return fallback;
}

function traceRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
): string[] {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    if (current && context.measureText(current + character).width > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const maxWidth = Math.max(1, width);
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      if (context.measureText(word).width > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
        }
        const chunks = splitLongWord(context, word, maxWidth);
        lines.push(...chunks.slice(0, -1));
        line = chunks.at(-1) ?? "";
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  if (image.complete && image.naturalWidth > 0) return image;
  if (typeof image.decode === "function") {
    try {
      await image.decode();
      return image;
    } catch {
      // Fall through to the load events, which also cover stale decode failures.
    }
  }
  await new Promise<void>((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error("An image could not be loaded."));
      return;
    }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("An image could not be loaded."));
  });
  return image;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceWidth / sourceHeight > width / height) {
    cropWidth = sourceHeight * (width / height);
  } else {
    cropHeight = sourceWidth / (width / height);
  }
  context.drawImage(
    image,
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    x,
    y,
    width,
    height,
  );
}

async function drawLayer(context: CanvasRenderingContext2D, layer: Layer): Promise<void> {
  const width = Math.max(0, layer.width);
  const height = Math.max(0, layer.height);
  if (width === 0 || height === 0) return;

  const image = layer.kind === "image" ? await loadImage(layer.src) : null;
  const shapeImage =
    (layer.kind === "rect" || layer.kind === "ellipse") && layer.fillImage
      ? await loadImage(layer.fillImage).catch(() => null)
      : null;
  context.save();
  try {
    if (layer.kind === "rect") {
      traceRoundRect(context, layer.x, layer.y, width, height, layer.radius);
      if (shapeImage) {
        context.clip();
        drawCover(context, shapeImage, layer.x, layer.y, width, height);
      } else {
        context.fillStyle = "#000000";
        context.fillStyle = layer.fill;
        context.fill();
      }
    } else if (layer.kind === "ellipse") {
      context.beginPath();
      context.ellipse(
        layer.x + width / 2,
        layer.y + height / 2,
        width / 2,
        height / 2,
        0,
        0,
        Math.PI * 2,
      );
      if (shapeImage) {
        context.clip();
        drawCover(context, shapeImage, layer.x, layer.y, width, height);
      } else {
        context.fillStyle = "#000000";
        context.fillStyle = layer.fill;
        context.fill();
      }
    } else if (layer.kind === "image" && image) {
      drawCover(context, image, layer.x, layer.y, width, height);
    } else if (layer.kind === "text") {
      context.font = `${layer.fontWeight} ${layer.fontSize}px ${FONT_STACK}`;
      context.textBaseline = "top";
      context.fillStyle = "#ffffff";
      context.fillStyle = layer.color;
      const lineHeight = layer.fontSize * layer.lineHeight;
      const lines = wrapLines(context, layer.text, width);
      lines.forEach((line, index) => {
        const lineWidth = context.measureText(line).width;
        let offset = 0;
        if (layer.align === "center") offset = (width - lineWidth) / 2;
        else if (layer.align === "right") offset = width - lineWidth;
        context.fillText(line, layer.x + Math.max(0, offset), layer.y + index * lineHeight);
      });
    }
  } finally {
    context.restore();
  }
}

function layerVars(layer: Layer, scale: number): StyleVars {
  const base: StyleVars = {
    "--og-x": `${layer.x * scale}px`,
    "--og-y": `${layer.y * scale}px`,
    "--og-w": `${layer.width * scale}px`,
    "--og-h": `${layer.height * scale}px`,
  };
  if (layer.kind === "text") {
    return {
      ...base,
      "--og-color": layer.color,
      "--og-font-size": `${layer.fontSize * scale}px`,
      "--og-font-weight": String(layer.fontWeight),
      "--og-line-height": String(layer.lineHeight),
      "--og-align": layer.align,
    };
  }
  if (layer.kind === "image") return base;
  return {
    ...base,
    "--og-fill": layer.fill,
    "--og-fill-image": layer.fillImage ? `url("${layer.fillImage}")` : "none",
    "--og-radius": `${layer.radius * scale}px`,
  };
}

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorControl({ label, value, onChange }: ColorControlProps): JSX.Element {
  return (
    <div className="og-editor-field">
      <span>{label}</span>
      <div className="og-editor-color-controls">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} value`}
        />
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, step = 1, onChange }: NumberFieldProps): JSX.Element {
  return (
    <label className="og-editor-field-stack">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </label>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("The image could not be read."));
    };
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function OgVisualEditor(props: OgVisualEditorProps): JSX.Element {
  const { onClose, onExport } = props;
  const designWidth = dimension(props.width, 1200);
  const designHeight = dimension(props.height, 630);

  const [layers, setLayers] = useState<Layer[]>(() =>
    createInitialLayers(props, designWidth, designHeight),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const backgroundLayerId = layers.find((layer) => layer.name === "Background")?.id ?? null;
  const previewVars: StyleVars = { "--og-aspect": `${designWidth} / ${designHeight}` };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.key !== "Delete" && event.key !== "Backspace") || !selectedId) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      setLayers((current) => current.filter((layer) => layer.id !== selectedId));
      setSelectedId(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedId]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const next = element.clientWidth / designWidth;
      if (Number.isFinite(next) && next > 0) setScale(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [designWidth]);

  const updateLayer = useCallback((id: string, patch: LayerPatch) => {
    setLayers((current) =>
      current.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as Layer) : layer)),
    );
  }, []);

  const addLayer = useCallback((layer: Layer) => {
    setLayers((current) => [...current, layer]);
    setSelectedId(layer.id);
  }, []);

  const addTextLayer = useCallback(
    (variant: "title" | "subtext") => {
      const isTitle = variant === "title";
      addLayer({
        id: makeLayerId(),
        kind: "text",
        name: isTitle ? "Headline" : "Subtext",
        x: Math.round(designWidth * 0.08),
        y: Math.round(designHeight * (isTitle ? 0.45 : 0.78)),
        width: Math.round(designWidth * 0.72),
        height: Math.round(designHeight * (isTitle ? 0.28 : 0.12)),
        text: isTitle ? "New headline" : "Supporting text",
        fontSize: Math.round(designWidth * (isTitle ? 0.056 : 0.024)),
        fontWeight: isTitle ? 700 : 400,
        lineHeight: isTitle ? 1.1 : 1.3,
        color: isTitle ? "#f3f1e9" : "#b8bdb2",
        align: "left",
      });
    },
    [addLayer, designHeight, designWidth],
  );

  const addShapeLayer = useCallback(
    (kind: "rect" | "ellipse") => {
      const width = Math.round(designWidth * 0.24);
      const height = Math.round(designHeight * 0.32);
      addLayer({
        id: makeLayerId(),
        kind,
        name: kind === "rect" ? "Rectangle" : "Ellipse",
        x: Math.round((designWidth - width) / 2),
        y: Math.round((designHeight - height) / 2),
        width,
        height,
        fill: kind === "rect" ? ACCENT_FILL : SOFT_FILL,
        radius: kind === "rect" ? Math.round(designWidth * 0.012) : 0,
      });
    },
    [addLayer, designHeight, designWidth],
  );

  const openFilePicker = useCallback((targetId: string | null) => {
    fileTargetRef.current = targetId;
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setError("");
      try {
        const src = await readFileAsDataUrl(file);
        const targetId = fileTargetRef.current;
        fileTargetRef.current = null;
        if (targetId) {
          const target = layers.find((layer) => layer.id === targetId);
          if (target?.kind === "rect" || target?.kind === "ellipse") {
            updateLayer(targetId, { fillImage: src });
          } else {
            updateLayer(targetId, { src });
          }
          return;
        }
        let width = Math.round(designWidth * 0.3);
        let height = Math.round(designHeight * 0.4);
        try {
          const image = await loadImage(src);
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            width = Math.round(designWidth * 0.3);
            height = Math.max(1, Math.round(width * (image.naturalHeight / image.naturalWidth)));
          }
        } catch {
          // Keep a sensible default size when the browser cannot decode the file.
        }
        addLayer({
          id: makeLayerId(),
          kind: "image",
          name: "Image",
          x: Math.round((designWidth - width) / 2),
          y: Math.round((designHeight - height) / 2),
          width,
          height,
          src,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The image could not be added.");
      }
    },
    [addLayer, designHeight, designWidth, layers, updateLayer],
  );

  const handleLayerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, layer: Layer) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedId(layer.id);
      dragRef.current = {
        id: layer.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: layer.x,
        originY: layer.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleLayerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const ratio = Number.isFinite(scale) && scale > 0 ? scale : 1;
      updateLayer(drag.id, {
        x: Math.round(drag.originX + (event.clientX - drag.startX) / ratio),
        y: Math.round(drag.originY + (event.clientY - drag.startY) / ratio),
      });
    },
    [scale, updateLayer],
  );

  const handleLayerPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const handleLayerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, layer: Layer) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedId(layer.id);
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;
      if (event.key === "ArrowLeft") deltaX = -step;
      else if (event.key === "ArrowRight") deltaX = step;
      else if (event.key === "ArrowUp") deltaY = -step;
      else if (event.key === "ArrowDown") deltaY = step;
      if (deltaX === 0 && deltaY === 0) return;
      event.preventDefault();
      setSelectedId(layer.id);
      updateLayer(layer.id, { x: layer.x + deltaX, y: layer.y + deltaY });
    },
    [updateLayer],
  );

  const moveSelected = useCallback(
    (offset: number) => {
      if (!selectedId) return;
      setLayers((current) => {
        const from = current.findIndex((layer) => layer.id === selectedId);
        const to = from + offset;
        if (from < 0 || to < 0 || to >= current.length) return current;
        const reordered = [...current];
        [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
        return reordered;
      });
    },
    [selectedId],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setLayers((current) => current.filter((layer) => layer.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const exportPng = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = designWidth;
      canvas.height = designHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      for (const layer of layers) await drawLayer(context, layer);
      onExport({
        dataUrl: canvas.toDataURL("image/png"),
        width: designWidth,
        height: designHeight,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be exported.");
    } finally {
      setBusy(false);
    }
  }, [designHeight, designWidth, layers, onExport]);

  return createPortal(
    <div
      className="og-editor-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="og-editor-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="og-editor-header">
          <div className="og-editor-heading">
            <span>Brand assets</span>
            <strong id={headingId}>Visual OG editor</strong>
          </div>
          <div className="og-editor-header-actions">
            <span className="og-editor-dimensions" aria-label="Canvas dimensions">
              {designWidth} × {designHeight}
            </span>
            <button
              type="button"
              className="og-editor-button primary"
              onClick={() => void exportPng()}
              disabled={busy}
              aria-label="Export PNG"
            >
              <Download size={13} aria-hidden="true" />
              {busy ? "Exporting…" : "Export PNG"}
            </button>
            <button
              ref={closeRef}
              type="button"
              className="og-editor-icon-button"
              onClick={onClose}
              aria-label="Close visual editor"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="og-editor-body">
          <div className="og-editor-toolbar" role="toolbar" aria-label="Add layer">
            <button
              type="button"
              className="og-editor-button"
              onClick={() => addTextLayer("title")}
            >
              <Type size={13} aria-hidden="true" /> Text
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => addTextLayer("subtext")}
            >
              <AlignLeft size={13} aria-hidden="true" /> Subtext
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => addShapeLayer("rect")}
              aria-label="Add rectangle"
            >
              <Square size={13} aria-hidden="true" /> Rectangle
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => addShapeLayer("ellipse")}
              aria-label="Add ellipse"
            >
              <Circle size={13} aria-hidden="true" /> Ellipse
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => openFilePicker(null)}
              aria-label="Add image"
            >
              <ImagePlus size={13} aria-hidden="true" /> Image
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => backgroundLayerId && openFilePicker(backgroundLayerId)}
              disabled={!backgroundLayerId}
              aria-label="Set background image"
            >
              <ImagePlus size={13} aria-hidden="true" /> BG image
            </button>
            <span className="og-editor-toolbar-hint">Drag layers to move them</span>
          </div>

          <div
            className="og-editor-stage"
            role="presentation"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            <div
              ref={previewRef}
              className="og-editor-preview"
              role="presentation"
              style={previewVars}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) setSelectedId(null);
              }}
            >
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  ref={(node) => {
                    if (!node) return;
                    for (const [property, value] of Object.entries(layerVars(layer, scale))) {
                      node.style.setProperty(property, String(value));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${layer.name} layer`}
                  aria-pressed={selectedId === layer.id}
                  className={`og-editor-layer og-editor-layer--${layer.kind}${
                    selectedId === layer.id ? " selected" : ""
                  }`}
                  onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerUp}
                  onPointerCancel={handleLayerPointerUp}
                  onKeyDown={(event) => handleLayerKeyDown(event, layer)}
                >
                  {layer.kind === "text" ? layer.text : null}
                  {layer.kind === "image" ? <img src={layer.src} alt="" draggable={false} /> : null}
                </div>
              ))}
            </div>
          </div>

          <aside className="og-editor-inspector" aria-label="Layer inspector">
            {selectedLayer ? (
              <>
                <section className="og-editor-panel">
                  <h3 className="og-editor-panel-title">Layer</h3>
                  <div className="og-editor-selected-line">
                    <span className="og-editor-badge">{selectedLayer.kind}</span>
                    <strong>{selectedLayer.name}</strong>
                  </div>
                </section>

                {selectedLayer.kind === "text" ? (
                  <section className="og-editor-panel">
                    <h3 className="og-editor-panel-title">Text</h3>
                    <label className="og-editor-field-stack">
                      <span>Content</span>
                      <textarea
                        value={selectedLayer.text}
                        onChange={(event) =>
                          updateLayer(selectedLayer.id, { text: event.target.value })
                        }
                        rows={3}
                        spellCheck={false}
                        aria-label="Text content"
                      />
                    </label>
                    <div className="og-editor-grid">
                      <NumberField
                        label="Font size"
                        value={selectedLayer.fontSize}
                        min={1}
                        onChange={(fontSize) => updateLayer(selectedLayer.id, { fontSize })}
                      />
                      <label className="og-editor-field-stack">
                        <span>Weight</span>
                        <select
                          value={selectedLayer.fontWeight}
                          onChange={(event) =>
                            updateLayer(selectedLayer.id, {
                              fontWeight: Number(event.target.value),
                            })
                          }
                          aria-label="Font weight"
                        >
                          <option value={400}>400</option>
                          <option value={500}>500</option>
                          <option value={600}>600</option>
                          <option value={700}>700</option>
                          <option value={800}>800</option>
                        </select>
                      </label>
                      <NumberField
                        label="Line height"
                        value={selectedLayer.lineHeight}
                        min={0.5}
                        step={0.05}
                        onChange={(lineHeight) => updateLayer(selectedLayer.id, { lineHeight })}
                      />
                      <label className="og-editor-field-stack">
                        <span>Align</span>
                        <select
                          value={selectedLayer.align}
                          onChange={(event) =>
                            updateLayer(selectedLayer.id, {
                              align: event.target.value as TextAlign,
                            })
                          }
                          aria-label="Text alignment"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                    </div>
                    <ColorControl
                      label="Color"
                      value={selectedLayer.color}
                      onChange={(color) => updateLayer(selectedLayer.id, { color })}
                    />
                  </section>
                ) : null}

                {(selectedLayer.kind === "rect" || selectedLayer.kind === "ellipse") && (
                  <section className="og-editor-panel">
                    <h3 className="og-editor-panel-title">Shape</h3>
                    <ColorControl
                      label="Fill"
                      value={selectedLayer.fill}
                      onChange={(fill) => updateLayer(selectedLayer.id, { fill })}
                    />
                    <div className="og-editor-actions">
                      <button
                        type="button"
                        className="og-editor-button"
                        onClick={() => openFilePicker(selectedLayer.id)}
                      >
                        <ImagePlus size={13} aria-hidden="true" />
                        {selectedLayer.fillImage ? "Replace image" : "Set image"}
                      </button>
                      {selectedLayer.fillImage ? (
                        <button
                          type="button"
                          className="og-editor-button"
                          onClick={() => updateLayer(selectedLayer.id, { fillImage: "" })}
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    {selectedLayer.kind === "rect" ? (
                      <NumberField
                        label="Radius"
                        value={selectedLayer.radius}
                        min={0}
                        onChange={(radius) => updateLayer(selectedLayer.id, { radius })}
                      />
                    ) : null}
                  </section>
                )}

                {selectedLayer.kind === "image" ? (
                  <section className="og-editor-panel">
                    <h3 className="og-editor-panel-title">Image</h3>
                    <button
                      type="button"
                      className="og-editor-button"
                      onClick={() => openFilePicker(selectedLayer.id)}
                    >
                      <ImagePlus size={13} aria-hidden="true" /> Replace image
                    </button>
                  </section>
                ) : null}

                <section className="og-editor-panel">
                  <h3 className="og-editor-panel-title">Position &amp; size</h3>
                  <div className="og-editor-grid">
                    <NumberField
                      label="X"
                      value={selectedLayer.x}
                      onChange={(x) => updateLayer(selectedLayer.id, { x })}
                    />
                    <NumberField
                      label="Y"
                      value={selectedLayer.y}
                      onChange={(y) => updateLayer(selectedLayer.id, { y })}
                    />
                    <NumberField
                      label="Width"
                      value={selectedLayer.width}
                      min={1}
                      onChange={(width) => updateLayer(selectedLayer.id, { width })}
                    />
                    <NumberField
                      label="Height"
                      value={selectedLayer.height}
                      min={1}
                      onChange={(height) => updateLayer(selectedLayer.id, { height })}
                    />
                  </div>
                </section>

                <section className="og-editor-panel">
                  <h3 className="og-editor-panel-title">Arrange</h3>
                  <div className="og-editor-actions">
                    <button
                      type="button"
                      className="og-editor-button"
                      onClick={() => moveSelected(1)}
                      aria-label="Bring layer forward"
                    >
                      <ArrowUp size={13} aria-hidden="true" /> Forward
                    </button>
                    <button
                      type="button"
                      className="og-editor-button"
                      onClick={() => moveSelected(-1)}
                      aria-label="Send layer backward"
                    >
                      <ArrowDown size={13} aria-hidden="true" /> Backward
                    </button>
                    <button
                      type="button"
                      className="og-editor-button danger"
                      onClick={deleteSelected}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="og-editor-empty">Select a layer to edit it.</div>
            )}

            <section className="og-editor-panel">
              <h3 className="og-editor-panel-title">Layers</h3>
              <div className="og-editor-layer-list">
                {layers.map((layer, index) => (
                  <button
                    key={layer.id}
                    type="button"
                    className={`og-editor-layer-item${selectedId === layer.id ? " selected" : ""}`}
                    aria-pressed={selectedId === layer.id}
                    onClick={() => setSelectedId(layer.id)}
                  >
                    <span>
                      {index + 1}. {layer.name}
                    </span>
                    <span className="og-editor-badge">{layer.kind}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <footer className="og-editor-footer">
          <span>
            {error ? (
              <span className="og-editor-error" role="alert">
                {error}
              </span>
            ) : (
              "Delete removes the selected layer · Drag or use arrow keys to move"
            )}
          </span>
          <span>{layers.length} layers</span>
        </footer>

        <input
          ref={fileRef}
          className="og-editor-file-input"
          type="file"
          accept="image/*"
          onChange={(event) => void handleFile(event)}
          aria-label="Choose an image file"
          tabIndex={-1}
        />
      </div>
    </div>,
    document.body,
  );
}
