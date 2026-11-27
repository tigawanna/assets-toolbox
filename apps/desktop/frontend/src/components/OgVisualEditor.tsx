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
  LayoutTemplate,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";

import { deleteTemplate, listTemplates, saveTemplate } from "../lib/templates/client";
import type { TemplateRecord } from "../lib/templates/types";
import "../modules/brand-assets/og-editor.css";

export interface OgDesignResult {
  dataUrl: string;
  width: number;
  height: number;
}

export interface OgEditorDraft {
  layers: Layer[];
  selectedId: string | null;
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
  initialDraft?: OgEditorDraft | null;
  onDraftChange?: (draft: OgEditorDraft) => void;
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

interface ShapeGradient {
  start: string;
  end: string;
  angle: number;
  startPosition?: number;
  endPosition?: number;
  middle?: { color: string; position: number } | null;
}

const GRADIENT_DIRECTIONS: ReadonlyArray<{ angle: number; label: string; glyph: string }> = [
  { angle: 0, label: "Bottom to top", glyph: "↑" },
  { angle: 45, label: "Bottom-left to top-right", glyph: "↗" },
  { angle: 90, label: "Left to right", glyph: "→" },
  { angle: 135, label: "Bottom-right to top-left", glyph: "↖" },
  { angle: 180, label: "Top to bottom", glyph: "↓" },
  { angle: 225, label: "Top-right to bottom-left", glyph: "↙" },
  { angle: 270, label: "Right to left", glyph: "←" },
  { angle: 315, label: "Top-left to bottom-right", glyph: "↘" },
];

const GRADIENT_PRESETS: ReadonlyArray<{ start: string; end: string; angle: number }> = [
  { start: "#ff7a18", end: "#af002d", angle: 180 },
  { start: "#f6d365", end: "#fda085", angle: 135 },
  { start: "#ff9a9e", end: "#fecfef", angle: 180 },
  { start: "#a1c4fd", end: "#c2e9fb", angle: 135 },
  { start: "#84fab0", end: "#8fd3f4", angle: 135 },
  { start: "#fbc2eb", end: "#a6c1ee", angle: 135 },
  { start: "#4facfe", end: "#00f2fe", angle: 90 },
  { start: "#43e97b", end: "#38f9d7", angle: 135 },
  { start: "#fa709a", end: "#fee140", angle: 135 },
  { start: "#30cfd0", end: "#330867", angle: 135 },
  { start: "#c471ed", end: "#f64f59", angle: 135 },
  { start: "#0f100f", end: "#b65e37", angle: 135 },
];

interface ShapeLayer extends LayerBase {
  kind: "rect" | "ellipse";
  fill: string;
  fillImage?: string;
  fillGradient?: ShapeGradient;
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
  fillGradient?: ShapeGradient | null;
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
  originWidth: number;
  originHeight: number;
  mode: "move" | "resize";
  corner?: "nw" | "ne" | "sw" | "se";
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

export function createOgLayers(
  props: { title?: string; description?: string; siteLabel?: string; imageUrl?: string },
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

type OgTemplateInput = {
  title?: string;
  description?: string;
  siteLabel?: string;
  imageUrl?: string;
};

function textLayer(
  name: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  color: string,
  fontWeight = 600,
  align: TextAlign = "left",
): TextLayer {
  return {
    id: makeLayerId(),
    kind: "text",
    name,
    x,
    y,
    width,
    height,
    text,
    fontSize,
    fontWeight,
    lineHeight: 1.2,
    color,
    align,
  };
}

function rectLayer(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 0,
): ShapeLayer {
  return { id: makeLayerId(), kind: "rect", name, x, y, width, height, fill, radius };
}

export interface OgTemplate {
  id: string;
  name: string;
  description: string;
  create: (input: OgTemplateInput, width: number, height: number) => Layer[];
}

export const OG_TEMPLATES: readonly OgTemplate[] = [
  {
    id: "gradient",
    name: "Bold gradient",
    description: "Warm full-bleed gradient with a strong headline and your mark.",
    create: (input, width, height) => {
      const layers: Layer[] = [
        {
          ...rectLayer("Background", 0, 0, width, height, "#ff7a18"),
          fillGradient: { start: "#ff7a18", end: "#c3137e", angle: 135 },
        },
        textLayer(
          "Site label",
          input.siteLabel?.trim() || "PROJECT",
          width * 0.07,
          height * 0.1,
          width * 0.5,
          height * 0.08,
          width * 0.022,
          "#3a1408",
          700,
        ),
        textLayer(
          "Headline",
          input.title?.trim() || "Your headline",
          width * 0.07,
          height * 0.4,
          width * (input.imageUrl ? 0.58 : 0.86),
          height * 0.34,
          width * 0.066,
          "#ffffff",
          800,
        ),
      ];
      if (input.description?.trim()) {
        layers.push(
          textLayer(
            "Description",
            input.description.trim(),
            width * 0.07,
            height * 0.77,
            width * 0.55,
            height * 0.14,
            width * 0.025,
            "#fff1e8",
            400,
          ),
        );
      }
      if (input.imageUrl) {
        layers.push({
          id: makeLayerId(),
          kind: "image",
          name: "Image",
          x: width * 0.68,
          y: height * 0.12,
          width: width * 0.25,
          height: width * 0.25,
          src: input.imageUrl,
        });
      }
      return layers;
    },
  },
  {
    id: "minimal",
    name: "Minimal clean",
    description: "Quiet white canvas, centered type, and a thin accent rule.",
    create: (input, width, height) => {
      const layers: Layer[] = [
        rectLayer("Background", 0, 0, width, height, "#faf9f5"),
        textLayer(
          "Site label",
          input.siteLabel?.trim() || "PROJECT",
          width * 0.1,
          height * 0.14,
          width * 0.8,
          height * 0.06,
          width * 0.018,
          "#8a8d82",
          600,
          "center",
        ),
        textLayer(
          "Headline",
          input.title?.trim() || "Your headline",
          width * 0.1,
          height * 0.32,
          width * 0.8,
          height * 0.32,
          width * 0.058,
          "#20241d",
          600,
          "center",
        ),
        rectLayer("Rule", width * 0.46, height * 0.68, width * 0.08, 3, ACCENT_FILL, 2),
      ];
      if (input.description?.trim()) {
        layers.push(
          textLayer(
            "Description",
            input.description.trim(),
            width * 0.18,
            height * 0.73,
            width * 0.64,
            height * 0.14,
            width * 0.024,
            "#6c7065",
            400,
            "center",
          ),
        );
      }
      if (input.imageUrl) {
        layers.push({
          id: makeLayerId(),
          kind: "image",
          name: "Image",
          x: width * 0.46,
          y: height * 0.05,
          width: width * 0.08,
          height: width * 0.08,
          src: input.imageUrl,
        });
      }
      return layers;
    },
  },
  {
    id: "magazine",
    name: "Magazine",
    description: "Editorial split with a category tag, headline, and image.",
    create: (input, width, height) => {
      const layers: Layer[] = [
        rectLayer("Background", 0, 0, width, height, "#f2f4f8"),
        rectLayer(
          "Category tag",
          width * 0.06,
          height * 0.12,
          width * 0.16,
          height * 0.07,
          "#dce7ff",
          6,
        ),
        textLayer(
          "Category",
          (input.siteLabel?.trim() || "PROJECT").toUpperCase(),
          width * 0.07,
          height * 0.135,
          width * 0.14,
          height * 0.05,
          width * 0.018,
          "#2d5bd6",
          700,
        ),
        textLayer(
          "Headline",
          input.title?.trim() || "Your headline",
          width * 0.06,
          height * 0.3,
          width * (input.imageUrl ? 0.52 : 0.86),
          height * 0.32,
          width * 0.058,
          "#151a24",
          700,
        ),
      ];
      if (input.description?.trim()) {
        layers.push(
          textLayer(
            "Description",
            input.description.trim(),
            width * 0.06,
            height * 0.65,
            width * 0.5,
            height * 0.16,
            width * 0.024,
            "#4b5666",
            400,
          ),
        );
      }
      if (input.imageUrl) {
        layers.push({
          id: makeLayerId(),
          kind: "image",
          name: "Image",
          x: width * 0.62,
          y: height * 0.12,
          width: width * 0.32,
          height: height * 0.7,
          src: input.imageUrl,
        });
      }
      layers.push({
        id: makeLayerId(),
        kind: "ellipse",
        name: "Accent dot",
        x: width * 0.9,
        y: height * 0.08,
        width: 18,
        height: 18,
        fill: "#3b7bf0",
        radius: 0,
      });
      return layers;
    },
  },
  {
    id: "dev",
    name: "Dev card",
    description: "Developer-style card with a code panel and accent dots.",
    create: (input, width, height) => {
      const layers: Layer[] = [
        {
          ...rectLayer("Background", 0, 0, width, height, "#0d1117"),
          fillGradient: { start: "#111827", end: "#0d1117", angle: 180 },
        },
        textLayer(
          "Site label",
          (input.siteLabel?.trim() || "PROJECT").toUpperCase(),
          width * 0.06,
          height * 0.12,
          width * 0.5,
          height * 0.07,
          width * 0.02,
          "#7dd3fc",
          700,
        ),
        textLayer(
          "Headline",
          input.title?.trim() || "Your headline",
          width * 0.06,
          height * 0.3,
          width * 0.5,
          height * 0.3,
          width * 0.056,
          "#f3f4f6",
          700,
        ),
        rectLayer(
          "Code panel",
          width * 0.59,
          height * 0.16,
          width * 0.35,
          height * 0.68,
          "#171d27",
          12,
        ),
        textLayer(
          "Code line 1",
          "const app = createApp();",
          width * 0.62,
          height * 0.24,
          width * 0.3,
          height * 0.05,
          width * 0.018,
          "#f9a8d4",
          500,
        ),
        textLayer(
          "Code line 2",
          "await app.build();",
          width * 0.62,
          height * 0.34,
          width * 0.3,
          height * 0.05,
          width * 0.018,
          "#86efac",
          500,
        ),
        textLayer(
          "Code line 3",
          "console.log('done');",
          width * 0.62,
          height * 0.44,
          width * 0.3,
          height * 0.05,
          width * 0.018,
          "#93c5fd",
          500,
        ),
      ];
      if (input.description?.trim()) {
        layers.push(
          textLayer(
            "Description",
            input.description.trim(),
            width * 0.06,
            height * 0.64,
            width * 0.48,
            height * 0.14,
            width * 0.024,
            "#9ca3af",
            400,
          ),
        );
      }
      if (input.imageUrl) {
        layers.push({
          id: makeLayerId(),
          kind: "ellipse",
          name: "Avatar",
          x: width * 0.88,
          y: height * 0.78,
          width: width * 0.07,
          height: width * 0.07,
          fill: "#1f2937",
          fillImage: input.imageUrl,
          radius: 0,
        });
      }
      return layers;
    },
  },
  {
    id: "corporate",
    name: "Corporate split",
    description: "Two-panel brand layout with a bold accent rule.",
    create: (input, width, height) => {
      const layers: Layer[] = [
        rectLayer("Background", 0, 0, width, height, "#eef2fb"),
        rectLayer("Brand panel", 0, 0, width * 0.42, height, "#dbe6ff"),
        rectLayer("Accent rule", width * 0.42, 0, 5, height, "#2563eb"),
        textLayer(
          "Company",
          input.siteLabel?.trim() || "PROJECT",
          width * 0.05,
          height * 0.34,
          width * 0.32,
          height * 0.12,
          width * 0.042,
          "#1d4ed8",
          700,
        ),
        textLayer(
          "Headline",
          input.title?.trim() || "Your headline",
          width * 0.49,
          height * 0.26,
          width * 0.46,
          height * 0.34,
          width * 0.052,
          "#111827",
          700,
        ),
        rectLayer("Underline", width * 0.49, height * 0.72, width * 0.12, 4, "#2563eb", 2),
      ];
      if (input.description?.trim()) {
        layers.push(
          textLayer(
            "Description",
            input.description.trim(),
            width * 0.49,
            height * 0.62,
            width * 0.44,
            height * 0.14,
            width * 0.024,
            "#4b5563",
            400,
          ),
        );
      }
      if (input.imageUrl) {
        layers.push({
          id: makeLayerId(),
          kind: "image",
          name: "Image",
          x: width * 0.13,
          y: height * 0.1,
          width: width * 0.16,
          height: width * 0.16,
          src: input.imageUrl,
        });
      }
      return layers;
    },
  },
];

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

function applyShapeFill(context: CanvasRenderingContext2D, layer: ShapeLayer): void {
  const gradient = layer.fillGradient;
  if (!gradient) {
    context.fillStyle = layer.fill;
    return;
  }
  const angle = (gradient.angle * Math.PI) / 180;
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  const deltaX = Math.sin(angle) * (layer.width / 2);
  const deltaY = -Math.cos(angle) * (layer.height / 2);
  const fill = context.createLinearGradient(
    centerX - deltaX,
    centerY - deltaY,
    centerX + deltaX,
    centerY + deltaY,
  );
  const clampStop = (value: number | undefined, fallback: number) =>
    Math.min(1, Math.max(0, (Number.isFinite(value) ? (value as number) : fallback) / 100));
  fill.addColorStop(clampStop(gradient.startPosition, 0), gradient.start);
  if (gradient.middle) {
    fill.addColorStop(clampStop(gradient.middle.position, 50), gradient.middle.color);
  }
  fill.addColorStop(clampStop(gradient.endPosition, 100), gradient.end);
  context.fillStyle = fill;
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
  // Canvas path state is not restored by save()/restore(), so each layer needs
  // a fresh path or later shapes would refill earlier ones.
  context.beginPath();
  try {
    if (layer.kind === "rect") {
      traceRoundRect(context, layer.x, layer.y, width, height, layer.radius);
      if (shapeImage) {
        context.clip();
        drawCover(context, shapeImage, layer.x, layer.y, width, height);
      } else {
        applyShapeFill(context, layer);
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
        applyShapeFill(context, layer);
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

export async function renderOgLayers(
  layers: Layer[],
  width: number,
  height: number,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return "";
  for (const layer of layers) await drawLayer(context, layer);
  return canvas.toDataURL("image/png");
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
  const gradientStyle = layer.fillGradient;
  const gradient = gradientStyle
    ? `linear-gradient(${gradientStyle.angle}deg, ${gradientStyle.start} ${gradientStyle.startPosition ?? 0}%${
        gradientStyle.middle
          ? `, ${gradientStyle.middle.color} ${gradientStyle.middle.position}%`
          : ""
      }, ${gradientStyle.end} ${gradientStyle.endPosition ?? 100}%)`
    : "none";
  return {
    ...base,
    "--og-fill": layer.fill,
    "--og-fill-image": layer.fillImage ? `url("${layer.fillImage}")` : gradient,
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

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <label className="og-editor-field-stack">
      <span>
        {label} · {Math.round(value)}%
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        aria-label={label}
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps): JSX.Element {
  return (
    <label className="og-editor-field-stack">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
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

  const [layers, setLayers] = useState<Layer[]>(() => {
    const draft = props.initialDraft;
    if (
      draft &&
      Array.isArray(draft.layers) &&
      draft.layers.every((layer) => layer && typeof layer.id === "string")
    ) {
      return draft.layers;
    }
    return createOgLayers(props, designWidth, designHeight);
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialDraft?.selectedId ?? null,
  );
  const [history, setHistory] = useState<Layer[][]>([]);
  const [future, setFuture] = useState<Layer[][]>([]);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(
    !props.initialDraft || props.initialDraft.layers.length === 0,
  );
  const [templatePreviews, setTemplatePreviews] = useState<Record<string, string>>({});
  const [savedTemplates, setSavedTemplates] = useState<Array<TemplateRecord<OgEditorDraft>>>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState("");

  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragSnapshotRef = useRef<Layer[] | null>(null);

  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const backgroundLayerId = layers.find((layer) => layer.name === "Background")?.id ?? null;
  const previewVars: StyleVars = { "--og-aspect": `${designWidth} / ${designHeight}` };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    props.onDraftChange?.({
      layers,
      selectedId,
      width: designWidth,
      height: designHeight,
    });
  }, [designHeight, designWidth, layers, selectedId, props.onDraftChange]);

  useEffect(() => {
    let active = true;
    void listTemplates<OgEditorDraft>("brand")
      .then((templates) => {
        if (active) setSavedTemplates(templates);
      })
      .catch(() => {
        // Saved templates are optional; the built-ins still work.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const input = {
      title: props.title,
      description: props.description,
      siteLabel: props.siteLabel,
      imageUrl: props.imageUrl,
    };
    const jobs = [
      ...OG_TEMPLATES.map((template) => ({
        id: template.id,
        layers: template.create(input, designWidth, designHeight),
        width: designWidth,
        height: designHeight,
      })),
      ...savedTemplates.map((template) => ({
        id: template.id,
        layers: template.data.layers,
        width: template.data.width || designWidth,
        height: template.data.height || designHeight,
      })),
    ];
    void Promise.all(
      jobs.map(async (job) => {
        const dataUrl = await renderOgLayers(job.layers, job.width, job.height);
        return [job.id, dataUrl] as const;
      }),
    ).then((entries) => {
      if (active) setTemplatePreviews(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [
    designHeight,
    designWidth,
    props.description,
    props.imageUrl,
    props.siteLabel,
    props.title,
    savedTemplates,
  ]);

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

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-49), layers]);
    setFuture([]);
  }, [layers]);

  const updateLayer = useCallback(
    (id: string, patch: LayerPatch, recordHistory = true) => {
      if (recordHistory) pushHistory();
      setLayers((current) =>
        current.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as Layer) : layer)),
      );
    },
    [pushHistory],
  );

  const addLayer = useCallback(
    (layer: Layer) => {
      pushHistory();
      setLayers((current) => [...current, layer]);
      setSelectedId(layer.id);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((current) => [layers, ...current].slice(0, 50));
    setLayers(previous);
    setHistory((current) => current.slice(0, -1));
    if (!previous.some((layer) => layer.id === selectedId)) setSelectedId(null);
  }, [history, layers, selectedId]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((current) => [...current, layers].slice(-50));
    setLayers(next);
    setFuture((current) => current.slice(1));
    if (!next.some((layer) => layer.id === selectedId)) setSelectedId(null);
  }, [future, layers, selectedId]);

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

  const applyFormText = useCallback(() => {
    pushHistory();
    setLayers((current) =>
      current.map((layer) => {
        if (layer.kind !== "text") return layer;
        if (layer.name === "Site label") {
          return { ...layer, text: props.siteLabel?.trim() || "PROJECT" };
        }
        if (layer.name === "Headline") {
          return { ...layer, text: props.title?.trim() || "Your headline" };
        }
        if (layer.name === "Description") {
          return { ...layer, text: props.description?.trim() || "" };
        }
        return layer;
      }),
    );
  }, [props.description, props.siteLabel, props.title, pushHistory]);

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
      dragSnapshotRef.current = layers;
      dragRef.current = {
        id: layer.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: layer.x,
        originY: layer.y,
        originWidth: layer.width,
        originHeight: layer.height,
        mode: "move",
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layers],
  );

  const handleLayerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || drag.mode !== "move") return;
      const ratio = Number.isFinite(scale) && scale > 0 ? scale : 1;
      updateLayer(
        drag.id,
        {
          x: Math.round(drag.originX + (event.clientX - drag.startX) / ratio),
          y: Math.round(drag.originY + (event.clientY - drag.startY) / ratio),
        },
        false,
      );
    },
    [scale, updateLayer],
  );

  const handleLayerPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || drag.mode !== "move") return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      dragRef.current = null;
      if (!snapshot) return;
      const changed = layers.some((layer, index) => {
        const before = snapshot[index];
        return !before || before.x !== layer.x || before.y !== layer.y;
      });
      if (changed) {
        setHistory((current) => [...current.slice(-49), snapshot]);
        setFuture([]);
      }
    },
    [layers],
  );

  const handleResizePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      layer: Layer,
      corner: NonNullable<DragState["corner"]>,
    ) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedId(layer.id);
      dragSnapshotRef.current = layers;
      dragRef.current = {
        id: layer.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: layer.x,
        originY: layer.y,
        originWidth: layer.width,
        originHeight: layer.height,
        mode: "resize",
        corner,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layers],
  );

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || drag.mode !== "resize" || !drag.corner) {
        return;
      }
      const ratio = Number.isFinite(scale) && scale > 0 ? scale : 1;
      const deltaX = (event.clientX - drag.startX) / ratio;
      const deltaY = (event.clientY - drag.startY) / ratio;
      let width =
        drag.corner === "nw" || drag.corner === "sw"
          ? drag.originWidth - deltaX
          : drag.originWidth + deltaX;
      let height =
        drag.corner === "nw" || drag.corner === "ne"
          ? drag.originHeight - deltaY
          : drag.originHeight + deltaY;
      width = Math.max(20, Math.round(width));
      height = Math.max(20, Math.round(height));
      if (event.shiftKey && drag.originHeight > 0) {
        height = Math.max(20, Math.round((width / drag.originWidth) * drag.originHeight));
      }
      const x =
        drag.corner === "nw" || drag.corner === "sw"
          ? drag.originX + (drag.originWidth - width)
          : drag.originX;
      const y =
        drag.corner === "nw" || drag.corner === "ne"
          ? drag.originY + (drag.originHeight - height)
          : drag.originY;
      updateLayer(drag.id, { x: Math.round(x), y: Math.round(y), width, height }, false);
    },
    [scale, updateLayer],
  );

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || drag.mode !== "resize") return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      dragRef.current = null;
      if (!snapshot) return;
      const changed = layers.some((layer, index) => {
        const before = snapshot[index];
        return (
          !before ||
          before.x !== layer.x ||
          before.y !== layer.y ||
          before.width !== layer.width ||
          before.height !== layer.height
        );
      });
      if (changed) {
        setHistory((current) => [...current.slice(-49), snapshot]);
        setFuture([]);
      }
    },
    [layers],
  );

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

  const chooseTemplate = useCallback(
    (template: OgTemplate) => {
      pushHistory();
      setLayers(
        template.create(
          {
            title: props.title,
            description: props.description,
            siteLabel: props.siteLabel,
            imageUrl: props.imageUrl,
          },
          designWidth,
          designHeight,
        ),
      );
      setSelectedId(null);
      setShowTemplates(false);
    },
    [
      designHeight,
      designWidth,
      props.description,
      props.imageUrl,
      props.siteLabel,
      props.title,
      pushHistory,
    ],
  );

  const clearDesign = useCallback(() => {
    pushHistory();
    setLayers([]);
    setSelectedId(null);
  }, [pushHistory]);

  const applyTemplateDraft = useCallback(
    (draft: OgEditorDraft) => {
      pushHistory();
      setLayers(draft.layers);
      setSelectedId(draft.selectedId ?? null);
      setShowTemplates(false);
    },
    [pushHistory],
  );

  const saveAsTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) return;
    try {
      const record = await saveTemplate<OgEditorDraft>({
        tool: "brand",
        name,
        description: `${designWidth} × ${designHeight} · ${layers.length} layers`,
        data: { layers, selectedId, width: designWidth, height: designHeight },
      });
      setSavedTemplates((current) => [record, ...current]);
      setTemplateName("");
      setTemplateError("");
    } catch {
      setTemplateError("Could not save that template.");
    }
  }, [designHeight, designWidth, layers, selectedId, templateName]);

  const removeTemplate = useCallback(async (id: string) => {
    await deleteTemplate(id);
    setSavedTemplates((current) => current.filter((template) => template.id !== id));
  }, []);

  const moveSelected = useCallback(
    (offset: number) => {
      if (!selectedId) return;
      pushHistory();
      setLayers((current) => {
        const from = current.findIndex((layer) => layer.id === selectedId);
        const to = from + offset;
        if (from < 0 || to < 0 || to >= current.length) return current;
        const reordered = [...current];
        [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
        return reordered;
      });
    },
    [pushHistory, selectedId],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    setLayers((current) => current.filter((layer) => layer.id !== selectedId));
    setSelectedId(null);
  }, [pushHistory, selectedId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']") !== null;
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y" && !typing) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.key !== "Delete" && event.key !== "Backspace") || !selectedId || typing) return;
      event.preventDefault();
      deleteSelected();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, onClose, redo, selectedId, undo]);

  const exportPng = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await renderOgLayers(layers, designWidth, designHeight);
      if (!dataUrl) throw new Error("Canvas is not available in this browser.");
      onExport({
        dataUrl,
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
              onClick={applyFormText}
              aria-label="Apply form text to layers"
            >
              <Type size={13} aria-hidden="true" /> Apply form text
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
            <button
              type="button"
              className="og-editor-button"
              onClick={clearDesign}
              aria-label="Clear design"
              title="Clear every layer and start over"
            >
              <Trash2 size={13} aria-hidden="true" /> Clear
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={() => setShowTemplates(true)}
              aria-label="Choose a template"
            >
              <LayoutTemplate size={13} aria-hidden="true" /> Templates
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={undo}
              disabled={history.length === 0}
              aria-label="Undo"
            >
              <Undo2 size={13} aria-hidden="true" /> Undo
            </button>
            <button
              type="button"
              className="og-editor-button"
              onClick={redo}
              disabled={future.length === 0}
              aria-label="Redo"
            >
              <Redo2 size={13} aria-hidden="true" /> Redo
            </button>
            <span className="og-editor-toolbar-hint">
              Ctrl+Z to undo · drag layers to move · drag corners to resize
            </span>
          </div>

          {showTemplates ? (
            <div className="og-editor-templates">
              <div className="og-editor-templates-head">
                <div>
                  <strong>Start with a template</strong>
                  <span>Pick a layout, then adjust anything in the editor.</span>
                </div>
                <div className="og-editor-template-save">
                  <input
                    aria-label="Template name"
                    value={templateName}
                    placeholder="Save current design as…"
                    onChange={(event) => setTemplateName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveAsTemplate();
                    }}
                  />
                  <button
                    type="button"
                    className="og-editor-button"
                    disabled={!templateName.trim()}
                    onClick={() => void saveAsTemplate()}
                  >
                    Save template
                  </button>
                  <button
                    type="button"
                    className="og-editor-button"
                    onClick={() => setShowTemplates(false)}
                  >
                    Keep current design
                  </button>
                </div>
              </div>
              {templateError ? <p className="og-editor-template-error">{templateError}</p> : null}
              <div className="og-editor-template-grid">
                {OG_TEMPLATES.map((template) => (
                  <button
                    className="og-editor-template-card"
                    type="button"
                    key={template.id}
                    onClick={() => chooseTemplate(template)}
                  >
                    <span className="og-editor-template-preview">
                      {templatePreviews[template.id] ? (
                        <img src={templatePreviews[template.id]} alt="" />
                      ) : null}
                    </span>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              {savedTemplates.length > 0 ? (
                <section className="og-editor-template-section">
                  <h3 className="og-editor-panel-title">Your templates</h3>
                  <div className="og-editor-template-grid">
                    {savedTemplates.map((template) => (
                      <div className="og-editor-template-card" key={template.id}>
                        <button
                          type="button"
                          className="og-editor-template-use"
                          onClick={() => applyTemplateDraft(template.data)}
                        >
                          <span className="og-editor-template-preview">
                            {templatePreviews[template.id] ? (
                              <img src={templatePreviews[template.id]} alt="" />
                            ) : null}
                          </span>
                          <strong>{template.name}</strong>
                          <span>{template.description}</span>
                        </button>
                        <button
                          type="button"
                          className="og-editor-template-delete"
                          aria-label={`Delete template ${template.name}`}
                          onClick={() => void removeTemplate(template.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

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
                    layer.name === "Background" ? " og-editor-layer--background" : ""
                  }${selectedId === layer.id ? " selected" : ""}`}
                  onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerUp}
                  onPointerCancel={handleLayerPointerUp}
                  onKeyDown={(event) => handleLayerKeyDown(event, layer)}
                >
                  {layer.kind === "text" ? layer.text : null}
                  {layer.kind === "image" ? <img src={layer.src} alt="" draggable={false} /> : null}
                  {selectedId === layer.id && layer.kind !== "text"
                    ? (["nw", "ne", "sw", "se"] as const).map((corner) => (
                        <button
                          key={corner}
                          type="button"
                          className={`og-editor-handle og-editor-handle--${corner}`}
                          aria-label={`Resize ${layer.name} from ${corner}`}
                          onPointerDown={(event) => handleResizePointerDown(event, layer, corner)}
                          onPointerMove={handleResizePointerMove}
                          onPointerUp={handleResizePointerUp}
                          onPointerCancel={handleResizePointerUp}
                        />
                      ))
                    : null}
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
                    <label className="og-editor-gradient-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedLayer.fillGradient)}
                        onChange={(event) =>
                          updateLayer(selectedLayer.id, {
                            fillGradient: event.currentTarget.checked
                              ? { start: selectedLayer.fill, end: "#ffffff", angle: 135 }
                              : null,
                          })
                        }
                      />
                      <span>Use gradient</span>
                    </label>
                    {selectedLayer.fillGradient ? (
                      <>
                        <div className="og-editor-gradient-presets" aria-label="Gradient presets">
                          {GRADIENT_PRESETS.map((preset) => {
                            const presetStyle: StyleVars = {
                              "--og-preset-image": `linear-gradient(${preset.angle}deg, ${preset.start}, ${preset.end})`,
                            };
                            return (
                              <button
                                key={`${preset.start}-${preset.end}`}
                                type="button"
                                className="og-editor-gradient-preset"
                                style={presetStyle}
                                aria-label={`Gradient ${preset.start} to ${preset.end}`}
                                onClick={() =>
                                  updateLayer(selectedLayer.id, {
                                    fillGradient: {
                                      ...selectedLayer.fillGradient!,
                                      start: preset.start,
                                      end: preset.end,
                                      angle: preset.angle,
                                      middle: null,
                                    },
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                        <div className="og-editor-directions" aria-label="Gradient direction">
                          {GRADIENT_DIRECTIONS.map((direction) => (
                            <button
                              key={direction.angle}
                              type="button"
                              className={`og-editor-direction${
                                selectedLayer.fillGradient!.angle === direction.angle
                                  ? " selected"
                                  : ""
                              }`}
                              aria-label={direction.label}
                              title={direction.label}
                              onClick={() =>
                                updateLayer(selectedLayer.id, {
                                  fillGradient: {
                                    ...selectedLayer.fillGradient!,
                                    angle: direction.angle,
                                  },
                                })
                              }
                            >
                              {direction.glyph}
                            </button>
                          ))}
                        </div>
                        <ColorControl
                          label="Gradient start"
                          value={selectedLayer.fillGradient.start}
                          onChange={(start) =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: { ...selectedLayer.fillGradient!, start },
                            })
                          }
                        />
                        <RangeField
                          label="Start position"
                          value={selectedLayer.fillGradient.startPosition ?? 0}
                          onChange={(startPosition) =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: { ...selectedLayer.fillGradient!, startPosition },
                            })
                          }
                        />
                        <ColorControl
                          label="Gradient end"
                          value={selectedLayer.fillGradient.end}
                          onChange={(end) =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: { ...selectedLayer.fillGradient!, end },
                            })
                          }
                        />
                        <RangeField
                          label="End position"
                          value={selectedLayer.fillGradient.endPosition ?? 100}
                          onChange={(endPosition) =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: { ...selectedLayer.fillGradient!, endPosition },
                            })
                          }
                        />
                        <button
                          type="button"
                          className="og-editor-button"
                          onClick={() =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: {
                                ...selectedLayer.fillGradient!,
                                middle: selectedLayer.fillGradient!.middle
                                  ? null
                                  : { color: ACCENT_FILL, position: 50 },
                              },
                            })
                          }
                        >
                          {selectedLayer.fillGradient.middle
                            ? "Remove middle stop"
                            : "Add middle stop"}
                        </button>
                        {selectedLayer.fillGradient.middle ? (
                          <>
                            <ColorControl
                              label="Middle color"
                              value={selectedLayer.fillGradient.middle.color}
                              onChange={(color) =>
                                updateLayer(selectedLayer.id, {
                                  fillGradient: {
                                    ...selectedLayer.fillGradient!,
                                    middle: { ...selectedLayer.fillGradient!.middle!, color },
                                  },
                                })
                              }
                            />
                            <RangeField
                              label="Middle position"
                              value={selectedLayer.fillGradient.middle.position}
                              onChange={(position) =>
                                updateLayer(selectedLayer.id, {
                                  fillGradient: {
                                    ...selectedLayer.fillGradient!,
                                    middle: { ...selectedLayer.fillGradient!.middle!, position },
                                  },
                                })
                              }
                            />
                          </>
                        ) : null}
                        <NumberField
                          label="Angle"
                          value={selectedLayer.fillGradient.angle}
                          min={0}
                          max={360}
                          onChange={(angle) =>
                            updateLayer(selectedLayer.id, {
                              fillGradient: { ...selectedLayer.fillGradient!, angle },
                            })
                          }
                        />
                      </>
                    ) : null}
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
              "Delete removes the selected layer · Drag to move · Drag corners to resize · Shift keeps ratio"
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
