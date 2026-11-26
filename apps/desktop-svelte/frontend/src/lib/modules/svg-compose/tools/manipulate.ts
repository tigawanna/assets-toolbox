/**
 * On-canvas manipulators. Like the node tool, their handles live in the tool
 * overlay so they can never be exported. Each drag writes one undo step.
 */
import type { Stage, StagePoint } from "../canvas/stage";
import type { Tool, ToolContext } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const create = (tag: string) => document.createElementNS(SVG_NS, tag);

const round = (value: number) => Math.round(value * 100) / 100;
const at = (value: number) => String(round(value));

const normalizeAngle = (degrees: number) => ((degrees + 540) % 360) - 180;

type Handle = {
  x: number;
  y: number;
};

abstract class Manipulator implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;
  readonly manipulatorOnly = true;
  protected stage: Stage | null = null;
  protected handle: Handle | null = null;
  protected dragging = false;
  protected moved = false;
  private unsubscribe: (() => void) | null = null;

  onActivate(stage: Stage) {
    this.stage = stage;
    this.unsubscribe = stage.subscribe(() => {
      if (!this.dragging) this.load();
    });
    this.load();
  }

  protected abstract load(): void;

  protected render(lineFrom: Handle | null, color: string) {
    const overlay = this.stage?.toolOverlay;
    if (!overlay) return;
    overlay.replaceChildren();
    if (!this.handle) return;
    if (lineFrom) {
      const line = create("line");
      line.setAttribute("class", "manipulator-line");
      line.setAttribute("x1", at(lineFrom.x));
      line.setAttribute("y1", at(lineFrom.y));
      line.setAttribute("x2", at(this.handle.x));
      line.setAttribute("y2", at(this.handle.y));
      line.setAttribute("stroke", color);
      overlay.append(line);
    }
    const dot = create("circle");
    dot.setAttribute("class", "manipulator-handle");
    dot.setAttribute("cx", at(this.handle.x));
    dot.setAttribute("cy", at(this.handle.y));
    dot.setAttribute("r", String(6 / (this.stage?.zoomLevel ?? 1)));
    dot.setAttribute("stroke", color);
    dot.setAttribute("data-manipulator", this.id);
    overlay.append(dot);
  }

  protected begin(event: PointerEvent): boolean {
    const target = event.target as Element | null;
    if (target?.getAttribute("data-manipulator") !== this.id || !this.handle) return false;
    this.dragging = true;
    this.moved = false;
    try {
      this.stage?.svg.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events have no active pointer to capture.
    }
    return true;
  }

  protected checkpointOnce() {
    if (this.moved) return;
    this.moved = true;
    this.stage?.checkpoint();
  }

  onPointerUp({ event }: ToolContext) {
    this.dragging = false;
    try {
      this.stage?.svg.releasePointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events have no active pointer to capture.
    }
  }

  onDeactivate() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stage?.toolOverlay.replaceChildren();
    this.stage = null;
    this.handle = null;
    this.dragging = false;
  }

  protected pointer(event: PointerEvent): StagePoint {
    return this.stage?.screenToDoc(event.clientX, event.clientY) ?? { x: 0, y: 0 };
  }
}

export class CornerTool extends Manipulator {
  readonly id = "corner";
  readonly label = "Corners";
  private rect: SVGGraphicsElement | null = null;
  private corner: StagePoint = { x: 0, y: 0 };
  private scale = 1;
  private radius = 0;
  private isRect = true;
  private size = { width: 0, height: 0 };

  protected load() {
    const stage = this.stage;
    if (!stage) return;
    const selected = stage.selectedElements()[0];
    const tag = selected?.tagName.toLowerCase();
    const target =
      tag === "rect" || tag === "path" ? selected : (selected?.querySelector("rect, path") ?? null);
    this.rect = (target as SVGGraphicsElement | null) ?? null;
    this.isRect = target?.tagName.toLowerCase() === "rect";
    if (!this.rect) {
      this.handle = null;
      this.render(null, "#f59e0b");
      return;
    }
    const box = stage.elementBox(this.rect);
    if (!box) {
      this.handle = null;
      this.render(null, "#f59e0b");
      return;
    }
    const width = Number(this.rect.getAttribute("width")) || box.width || 1;
    this.scale = this.isRect ? box.width / width : 1;
    this.size = { width: box.width, height: box.height };
    this.radius = this.isRect
      ? Number(this.rect.getAttribute("rx") ?? 0) || 0
      : (Number(this.rect.getAttribute("data-corner") ?? 0) || 0) *
        (Math.min(box.width, box.height) / 2);
    this.corner = { x: box.x + box.width, y: box.y };
    this.handle = {
      x: this.corner.x - this.radius * this.scale,
      y: this.corner.y + this.radius * this.scale,
    };
    this.render(this.corner, "#f59e0b");
  }

  onPointerDown(context: ToolContext) {
    if (this.begin(context.event)) this.load();
  }

  onPointerMove({ event }: ToolContext) {
    if (!this.dragging) return;
    const point = this.pointer(event);
    if (!this.moved && Math.hypot(point.x - this.handle!.x, point.y - this.handle!.y) < 2) return;
    this.checkpointOnce();
    const dx = this.corner.x - point.x;
    const dy = point.y - this.corner.y;
    const max = this.isRect
      ? Math.min(
          (Number(this.rect?.getAttribute("width")) || 100) / 2,
          (Number(this.rect?.getAttribute("height")) || 100) / 2,
        )
      : Math.min(this.size.width, this.size.height) / 2;
    this.radius = Math.max(0, Math.min(Math.min(dx, dy) / this.scale, max));
    this.stage?.applyCornerRadius(this.radius);
    this.load();
  }
}

export class RotateTool extends Manipulator {
  readonly id = "rotate";
  readonly label = "Rotate";
  private center: StagePoint = { x: 0, y: 0 };
  private base = 0;
  private startAngle = 0;

  protected load() {
    const stage = this.stage;
    const element = stage?.selectedElements()[0];
    const box = element && stage ? stage.elementBox(element) : null;
    if (!box || !box.width || !box.height) {
      this.handle = null;
      this.render(null, "#34d399");
      return;
    }
    this.center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const distance = Math.max(box.width, box.height) / 2 + 46 / (stage?.zoomLevel ?? 1);
    this.handle = { x: this.center.x, y: this.center.y - distance };
    this.render(this.center, "#34d399");
  }

  onPointerDown(context: ToolContext) {
    if (!this.begin(context.event)) return;
    this.base = this.stage?.getSelectionStyle()?.rotation ?? 0;
    const point = this.pointer(context.event);
    this.startAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
  }

  onPointerMove({ event }: ToolContext) {
    if (!this.dragging || !this.handle) return;
    const point = this.pointer(event);
    if (Math.hypot(point.x - this.handle.x, point.y - this.handle.y) < 2 && !this.moved) return;
    this.checkpointOnce();
    const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
    const delta = (angle - this.startAngle) * (180 / Math.PI);
    this.stage?.applyRotation(normalizeAngle(this.base + delta));
    this.load();
  }
}
