/**
 * Drawing tools. Previews are drawn in the Stage's overlay (never exported);
 * a real document element is created only on a successful pointer-up.
 */
import type { Stage, StagePoint } from "../canvas/stage";
import { nextId } from "../doc/ids";
import { CornerTool, RotateTool } from "./manipulate";
import { NodeTool } from "./node";
import type { Tool, ToolContext } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const create = (tag: string) => document.createElementNS(SVG_NS, tag);

const preview = (stage: Stage, element: SVGElement) => {
  element.setAttribute("class", "tool-preview");
  stage.toolOverlay.append(element);
  return element;
};

const boxOf = (start: StagePoint, end: StagePoint) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

const round = (value: number) => Math.round(value * 100) / 100;
const position = (value: number) => String(round(value));

/** Base class for drag-to-create rectangle / ellipse / line tools. */
abstract class DragTool implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;
  protected abstract readonly tag: string;
  private start: StagePoint | null = null;
  private shape: SVGElement | null = null;

  protected abstract apply(shape: SVGElement, start: StagePoint, end: StagePoint): void;
  protected abstract createShape(): SVGElement;

  onPointerDown({ stage, event }: ToolContext) {
    this.start = stage.screenToScope(event.clientX, event.clientY);
    this.shape = preview(stage, this.createShape());
    this.apply(this.shape, this.start, this.start);
  }

  onPointerMove({ stage, event }: ToolContext) {
    if (!this.start || !this.shape) return;
    this.apply(this.shape, this.start, stage.screenToScope(event.clientX, event.clientY));
  }

  onPointerUp({ stage, event }: ToolContext) {
    if (!this.start || !this.shape) return;
    const end = stage.screenToScope(event.clientX, event.clientY);
    const box = boxOf(this.start, end);
    const bigEnough =
      this.tag === "line"
        ? Math.hypot(end.x - this.start.x, end.y - this.start.y) > 4
        : box.width > 3 && box.height > 3;

    if (bigEnough) {
      const shape = this.createShape();
      this.apply(shape, this.start, end);
      shape.id = nextId();
      stage.checkpoint();
      stage.appendToScope(shape);
      stage.select(shape.id);
    }
    this.cancel();
  }

  onKey(event: KeyboardEvent) {
    if (event.key === "Escape") this.cancel();
  }

  onDeactivate() {
    this.cancel();
  }

  private cancel() {
    this.shape?.remove();
    this.shape = null;
    this.start = null;
  }
}

export class RectTool extends DragTool {
  readonly id = "rect";
  readonly label = "Rectangle";
  protected readonly tag = "rect";

  protected createShape() {
    return create("rect");
  }

  protected apply(shape: SVGElement, start: StagePoint, end: StagePoint) {
    const box = boxOf(start, end);
    shape.setAttribute("x", position(box.x));
    shape.setAttribute("y", position(box.y));
    shape.setAttribute("width", position(box.width));
    shape.setAttribute("height", position(box.height));
    shape.setAttribute("rx", "4");
    if (!shape.classList.contains("tool-preview")) {
      shape.setAttribute("fill", "#a5b4fc");
      shape.setAttribute("stroke", "#312e81");
      shape.setAttribute("stroke-width", "2");
    }
  }
}

export class EllipseTool extends DragTool {
  readonly id = "ellipse";
  readonly label = "Ellipse";
  protected readonly tag = "ellipse";

  protected createShape() {
    return create("ellipse");
  }

  protected apply(shape: SVGElement, start: StagePoint, end: StagePoint) {
    const box = boxOf(start, end);
    shape.setAttribute("cx", position(box.x + box.width / 2));
    shape.setAttribute("cy", position(box.y + box.height / 2));
    shape.setAttribute("rx", position(box.width / 2));
    shape.setAttribute("ry", position(box.height / 2));
    if (!shape.classList.contains("tool-preview")) {
      shape.setAttribute("fill", "#fda4af");
      shape.setAttribute("stroke", "#831843");
      shape.setAttribute("stroke-width", "2");
    }
  }
}

export class LineTool extends DragTool {
  readonly id = "line";
  readonly label = "Line";
  protected readonly tag = "line";

  protected createShape() {
    return create("line");
  }

  protected apply(shape: SVGElement, start: StagePoint, end: StagePoint) {
    shape.setAttribute("x1", position(start.x));
    shape.setAttribute("y1", position(start.y));
    shape.setAttribute("x2", position(end.x));
    shape.setAttribute("y2", position(end.y));
    if (!shape.classList.contains("tool-preview")) {
      shape.setAttribute("stroke", "#312e81");
      shape.setAttribute("stroke-width", "30");
      shape.setAttribute("stroke-linecap", "round");
    }
  }
}

/** Click on the canvas to place editable text; edit its content in the inspector. */
export class TextTool implements Tool {
  readonly id = "text";
  readonly label = "Text";

  onPointerDown({ stage, event }: ToolContext) {
    const point = stage.screenToScope(event.clientX, event.clientY);
    const text = create("text");
    text.setAttribute("x", position(point.x));
    text.setAttribute("y", position(point.y));
    text.setAttribute("fill", "#1f2937");
    text.setAttribute("font-family", "Inter, sans-serif");
    text.setAttribute("font-size", "24");
    text.textContent = "Text";
    text.id = nextId();
    stage.checkpoint();
    stage.appendToScope(text);
    stage.select(text.id);
  }
}

/** Click to add points, Enter to finish, Escape to cancel. */
export class PenTool implements Tool {
  readonly id = "pen";
  readonly label = "Pen";
  private points: StagePoint[] = [];
  private shape: SVGPathElement | null = null;
  private stage: Stage | null = null;

  private pathData(cursor?: StagePoint) {
    const points = cursor ? [...this.points, cursor] : this.points;
    if (!points.length) return "";
    return `M ${points.map((point) => `${position(point.x)} ${position(point.y)}`).join(" L ")}`;
  }

  private render(cursor?: StagePoint) {
    if (!this.shape) return;
    this.shape.setAttribute("d", this.pathData(cursor));
  }

  onPointerDown({ stage, event }: ToolContext) {
    this.stage = stage;
    const point = stage.screenToScope(event.clientX, event.clientY);
    const first = this.points[0];
    if (first && Math.hypot(point.x - first.x, point.y - first.y) < 8 / stage.zoomLevel) {
      this.finish(stage, true);
      return;
    }
    if (!this.points.length) {
      this.shape = preview(stage, create("path")) as SVGPathElement;
    }
    this.points.push(point);
    this.render();
  }

  onPointerMove({ stage, event }: ToolContext) {
    if (!this.points.length) return;
    this.render(stage.screenToScope(event.clientX, event.clientY));
  }

  onKey(event: KeyboardEvent) {
    if (event.key === "Enter" && this.points.length >= 2) {
      event.preventDefault();
      const stage = this.stage;
      if (stage) this.finish(stage, false);
    } else if (event.key === "Escape") {
      this.cancel();
    }
  }

  onDeactivate() {
    this.cancel();
  }

  private finish(stage: Stage, closed: boolean) {
    if (this.points.length < 2) return this.cancel();
    const path = create("path");
    path.setAttribute("d", this.pathData() + (closed ? " Z" : ""));
    path.setAttribute("fill", closed ? "#a5b4fc" : "none");
    path.setAttribute("stroke", "#312e81");
    path.setAttribute("stroke-width", "2");
    path.id = nextId();
    stage.checkpoint();
    stage.appendToScope(path);
    stage.select(path.id);
    this.cancel();
  }

  private cancel() {
    this.shape?.remove();
    this.shape = null;
    this.points = [];
    this.stage = null;
  }
}

export const TOOLS: Tool[] = [
  new RectTool(),
  new EllipseTool(),
  new LineTool(),
  new PenTool(),
  new NodeTool(),
  new TextTool(),
  new CornerTool(),
  new RotateTool(),
];

export const toolById = (id: string | null): Tool | null =>
  id ? (TOOLS.find((tool) => tool.id === id) ?? null) : null;
