/**
 * Node tool: show anchors and bezier handles for the selected path, drag them
 * to edit live, and toggle smooth/corner nodes with S. Smoothing a converted
 * rectangle's corners is what turns it into an ellipse.
 */
import type { Stage, StagePoint } from "../canvas/stage";
import {
  makeCorner,
  makeSmooth,
  modelToPath,
  pathToModel,
  type PathModel,
  type PathNode,
} from "../doc/path";
import {
  applyMatrix,
  IDENTITY,
  invertMatrix,
  multiply,
  parseTransform,
  type Matrix,
} from "../doc/transform";
import type { Tool, ToolContext } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const create = (tag: string) => document.createElementNS(SVG_NS, tag);

type Drag = {
  kind: "node" | "in" | "out" | "endpoint";
  index: number;
  start: StagePoint;
  origin: PathModel;
  lineOrigin?: { x1: number; y1: number; x2: number; y2: number };
  moved?: boolean;
};

export class NodeTool implements Tool {
  readonly id = "node";
  readonly label = "Node";
  readonly manipulatorOnly = true;

  private stage: Stage | null = null;
  private path: SVGPathElement | null = null;
  private line: SVGLineElement | null = null;
  private model: PathModel | null = null;
  private world: Matrix = IDENTITY;
  private focus = -1;
  private drag: Drag | null = null;
  private mutating = false;
  private unsubscribe: (() => void) | null = null;

  onActivate(stage: Stage) {
    this.stage = stage;
    this.unsubscribe = stage.subscribe(() => {
      if (!this.drag && !this.mutating) this.load();
    });
    this.load();
  }

  private load() {
    const stage = this.stage;
    if (!stage) return;
    const selected = stage.selectedIds;
    const element =
      selected.length === 1 ? stage.docGroup.querySelector(`[id="${selected[0]}"]`) : null;
    const path = element?.tagName.toLowerCase() === "path" ? (element as SVGPathElement) : null;
    const line = element?.tagName.toLowerCase() === "line" ? (element as SVGLineElement) : null;
    this.path = path;
    this.line = line;
    this.model = path ? pathToModel(path.getAttribute("d")) : null;
    this.world = IDENTITY;
    if (line) {
      let matrix = parseTransform(line.getAttribute("transform"));
      let parent = line.parentElement;
      while (parent && parent.tagName.toLowerCase() !== "svg") {
        matrix = multiply(parseTransform(parent.getAttribute("transform")), matrix);
        parent = parent.parentElement;
      }
      this.world = matrix;
    }
    if (path) {
      let matrix = parseTransform(path.getAttribute("transform"));
      let parent = path.parentElement;
      while (parent && parent.tagName.toLowerCase() !== "svg") {
        matrix = multiply(parseTransform(parent.getAttribute("transform")), matrix);
        parent = parent.parentElement;
      }
      this.world = matrix;
    }
    this.focus = -1;
    this.render();
  }

  private localPoint(stage: Stage, event: PointerEvent): StagePoint {
    const point = stage.screenToDoc(event.clientX, event.clientY);
    return applyMatrix(invertMatrix(this.world), point.x, point.y);
  }

  private commit() {
    if (this.path && this.model) this.path.setAttribute("d", modelToPath(this.model));
    this.render();
  }

  private render() {
    const overlay = this.stage?.toolOverlay;
    if (!overlay) return;
    overlay.replaceChildren();

    if (this.line) {
      const line = this.line;
      const endpoints = [
        { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) },
        { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) },
      ];
      for (const [index, endpoint] of endpoints.entries()) {
        if (![endpoint.x, endpoint.y].every(Number.isFinite)) continue;
        const at = applyMatrix(this.world, endpoint.x, endpoint.y);
        const handle = create("rect");
        handle.setAttribute("class", "node-point");
        handle.setAttribute("x", String(at.x - 5));
        handle.setAttribute("y", String(at.y - 5));
        handle.setAttribute("width", "10");
        handle.setAttribute("height", "10");
        handle.setAttribute("data-manipulator", this.id);
        handle.setAttribute("data-endpoint", String(index));
        const title = create("title");
        title.textContent = "Drag to move this endpoint";
        handle.append(title);
        overlay.append(handle);
      }
      return;
    }

    if (!this.model) return;

    const screen = (x: number, y: number) => applyMatrix(this.world, x, y);
    this.model.nodes.forEach((item, index) => {
      const at = screen(item.x, item.y);
      for (const side of ["in", "out"] as const) {
        const handle = item[side];
        if (!handle) continue;
        const end = screen(item.x + handle.x, item.y + handle.y);
        const line = create("line");
        line.setAttribute("class", "node-handle-line");
        line.setAttribute("x1", String(at.x));
        line.setAttribute("y1", String(at.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        overlay.append(line);

        const circle = create("circle");
        circle.setAttribute("class", "node-handle");
        circle.setAttribute("cx", String(end.x));
        circle.setAttribute("cy", String(end.y));
        circle.setAttribute("r", "4");
        circle.setAttribute("data-manipulator", this.id);
        circle.setAttribute("data-node", String(index));
        circle.setAttribute("data-handle", side);
        overlay.append(circle);
      }

      const point = create("rect");
      point.setAttribute("class", index === this.focus ? "node-point focus" : "node-point");
      point.setAttribute("x", String(at.x - 4));
      point.setAttribute("y", String(at.y - 4));
      point.setAttribute("width", "8");
      point.setAttribute("height", "8");
      point.setAttribute("data-manipulator", this.id);
      point.setAttribute("data-node", String(index));
      overlay.append(point);
    });

    // Small dots on each segment insert a new node when clicked.
    const nodes = this.model.nodes;
    const segments = this.model.closed ? nodes.length : nodes.length - 1;
    for (let index = 0; index < segments; index += 1) {
      const from = nodes[index]!;
      const to = nodes[(index + 1) % nodes.length]!;
      const middle = this.segmentMiddle(from, to);
      const at = screen(middle.x, middle.y);
      const dot = create("circle");
      dot.setAttribute("class", "node-add");
      dot.setAttribute("cx", String(at.x));
      dot.setAttribute("cy", String(at.y));
      dot.setAttribute("r", String(6 / (this.stage?.zoomLevel ?? 1)));
      dot.setAttribute("data-manipulator", this.id);
      dot.setAttribute("data-node-action", "add");
      dot.setAttribute("data-segment", String(index));
      const title = create("title");
      title.textContent = "Click to add a node here";
      dot.append(title);
      overlay.append(dot);

      const arm = 2.5 / (this.stage?.zoomLevel ?? 1);
      for (const vertical of [false, true]) {
        const mark = create("line");
        mark.setAttribute("class", "node-add-plus");
        mark.setAttribute("x1", String(at.x - (vertical ? 0 : arm)));
        mark.setAttribute("y1", String(at.y - (vertical ? arm : 0)));
        mark.setAttribute("x2", String(at.x + (vertical ? 0 : arm)));
        mark.setAttribute("y2", String(at.y + (vertical ? arm : 0)));
        overlay.append(mark);
      }
    }
  }

  /** Midpoint of a segment, splitting bezier handles with de Casteljau. */
  private segmentMiddle(from: PathNode, to: PathNode): StagePoint {
    if (!from.out && !to.in) {
      return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }
    const p0 = { x: from.x, y: from.y };
    const p1 = { x: from.x + (from.out?.x ?? 0), y: from.y + (from.out?.y ?? 0) };
    const p2 = { x: to.x + (to.in?.x ?? 0), y: to.y + (to.in?.y ?? 0) };
    const p3 = { x: to.x, y: to.y };
    const half = (a: StagePoint, b: StagePoint): StagePoint => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });
    const q0 = half(p0, p1);
    const q1 = half(p1, p2);
    const q2 = half(p2, p3);
    return half(half(q0, q1), half(q1, q2));
  }

  private insertNode(segment: number, stage: Stage, event: PointerEvent) {
    const model = this.model;
    if (!model) return;
    const count = model.nodes.length;
    const from = model.nodes[segment % count]!;
    const to = model.nodes[(segment + 1) % count]!;
    let inserted: PathNode;

    if (from.out || to.in) {
      const p0 = { x: from.x, y: from.y };
      const p1 = { x: from.x + (from.out?.x ?? 0), y: from.y + (from.out?.y ?? 0) };
      const p2 = { x: to.x + (to.in?.x ?? 0), y: to.y + (to.in?.y ?? 0) };
      const p3 = { x: to.x, y: to.y };
      const half = (a: StagePoint, b: StagePoint): StagePoint => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      const q0 = half(p0, p1);
      const q1 = half(p1, p2);
      const q2 = half(p2, p3);
      const r0 = half(q0, q1);
      const r1 = half(q1, q2);
      const split = half(r0, r1);
      from.out = { x: q0.x - p0.x, y: q0.y - p0.y };
      to.in = { x: q2.x - p3.x, y: q2.y - p3.y };
      inserted = {
        x: split.x,
        y: split.y,
        in: { x: r0.x - split.x, y: r0.y - split.y },
        out: { x: r1.x - split.x, y: r1.y - split.y },
      };
    } else {
      inserted = {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        in: null,
        out: null,
      };
    }

    this.mutating = true;
    stage.checkpoint();
    model.nodes.splice(segment + 1, 0, inserted);
    this.focus = segment + 1;
    this.commit();
    this.mutating = false;
    this.drag = {
      kind: "node",
      index: this.focus,
      start: this.localPoint(stage, event),
      origin: JSON.parse(JSON.stringify(model)) as PathModel,
      moved: true, // insertion already checkpointed; the drag is the same step
    };
  }

  onPointerDown({ stage, event }: ToolContext) {
    if (this.line) {
      const target = event.target as Element | null;
      const endpoint = target?.getAttribute("data-endpoint");
      if (endpoint === null || endpoint === undefined) return;
      const index = Number(endpoint);
      if (index !== 0 && index !== 1) return;
      stage.checkpoint();
      this.drag = {
        kind: "endpoint",
        index,
        start: this.localPoint(stage, event),
        origin: {} as PathModel,
        lineOrigin: {
          x1: Number(this.line.getAttribute("x1")),
          y1: Number(this.line.getAttribute("y1")),
          x2: Number(this.line.getAttribute("x2")),
          y2: Number(this.line.getAttribute("y2")),
        },
      };
      return;
    }
    if (!this.model || !this.path) return;
    const target = event.target as Element | null;
    if (target?.getAttribute("data-node-action") === "add") {
      this.insertNode(Number(target.getAttribute("data-segment")), stage, event);
      return;
    }
    const index = Number(target?.getAttribute("data-node"));
    if (!Number.isFinite(index) || !this.model.nodes[index]) return;
    const side = target?.getAttribute("data-handle");

    this.focus = index;
    this.drag = {
      kind: side === "in" || side === "out" ? side : "node",
      index,
      start: this.localPoint(stage, event),
      origin: JSON.parse(JSON.stringify(this.model)) as PathModel,
    };
    stage.checkpoint();
    this.render();
  }

  onPointerMove({ stage, event }: ToolContext) {
    if (this.drag?.kind === "endpoint" && this.line && this.drag.lineOrigin) {
      const point = stage.screenToScope(event.clientX, event.clientY);
      if (this.drag.index === 0) {
        this.line.setAttribute("x1", String(point.x));
        this.line.setAttribute("y1", String(point.y));
      } else {
        this.line.setAttribute("x2", String(point.x));
        this.line.setAttribute("y2", String(point.y));
      }
      this.render();
      stage.notifyChange();
      return;
    }
    if (!this.drag || !this.model) return;
    if (this.drag.kind === "endpoint") return;
    const kind = this.drag.kind;
    const point = this.localPoint(stage, event);
    const target = this.model.nodes[this.drag.index]!;
    const origin = this.drag.origin.nodes[this.drag.index]!;

    if (kind === "node") {
      const dx = point.x - this.drag.start.x;
      const dy = point.y - this.drag.start.y;
      target.x = origin.x + dx;
      target.y = origin.y + dy;
      target.in = origin.in ? { ...origin.in } : null;
      target.out = origin.out ? { ...origin.out } : null;
    } else {
      const handle = { x: point.x - target.x, y: point.y - target.y };
      target[kind] = handle;
      // Keep the opposite handle collinear when the node is smooth.
      if (target.in && target.out) {
        const opposite = kind === "in" ? "out" : "in";
        target[opposite] = { x: -handle.x, y: -handle.y };
      }
    }
    this.commit();
  }

  onPointerUp() {
    this.drag = null;
  }

  onKey(event: KeyboardEvent) {
    if (!this.model || !this.path || this.focus < 0) return;
    const index = this.focus;
    const isSmoothToggle = event.key.toLowerCase() === "s";
    const isDelete = event.key === "Delete" || event.key === "Backspace";
    if (!isSmoothToggle && !isDelete && event.key !== "Escape") return;
    if (isDelete && this.model.nodes.length <= 2) return;

    event.preventDefault();
    this.mutating = true;
    const current = this.model.nodes[index]!;
    if (isSmoothToggle) {
      if (current.in || current.out) makeCorner(this.model, index);
      else makeSmooth(this.model, index);
    } else if (isDelete) {
      this.model.nodes.splice(index, 1);
      this.focus = -1;
    } else {
      this.focus = -1;
    }
    this.stage?.checkpoint();
    this.commit();
    this.mutating = false;
  }

  onDeactivate() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stage?.toolOverlay.replaceChildren();
    this.stage = null;
    this.model = null;
    this.path = null;
    this.drag = null;
  }
}
