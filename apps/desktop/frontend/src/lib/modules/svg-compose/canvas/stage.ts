/**
 * The editing surface: an imperative Stage that owns the live <svg> document.
 *
 * React never renders document nodes — it renders chrome and hands this class
 * a container element. All pointer math goes through getScreenCTM().inverse()
 * so zoom and pan never leak into document coordinates.
 *
 * Selection boxes and handles live in #overlay, a sibling of #doc, so they can
 * never be serialized into an export.
 */
import { toHexColor } from "../doc/color";
import { downloadText, safeBBox, serializeDocument } from "../doc/export";
import { importIntoDocument, parseSvg, type ImportBox } from "../doc/import";
import { assignIds, nextId, regenerateIds } from "../doc/ids";
import { makeCorner, makeSmooth, modelToPath, pathToModel, shapeToPathData } from "../doc/path";
import {
  bakeInto,
  IDENTITY,
  multiply,
  parseTransform,
  rotate,
  scale,
  setTransform,
  translate,
  type Matrix,
} from "../doc/transform";
import { HistoryStack } from "../history/stack";
import type { Tool, ToolContext } from "../tools/types";

export const SVG_NS = "http://www.w3.org/2000/svg";
const DOC_GROUP_ID = "doc";
const OVERLAY_ID = "overlay";

export type StagePoint = { x: number; y: number };
export type StageViewport = { zoom: number; tx: number; ty: number };
export type StageSnapshot = { svg: string; viewport: StageViewport };

export type LayerNode = {
  id: string;
  tag: string;
  label: string;
  hidden: boolean;
  locked: boolean;
  children: LayerNode[];
};

export type StylePatch = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
};

export type SelectionStyle = {
  tag: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string | null;
  fontSize: number;
  radius: number | null;
  rotation: number;
  count: number;
};

type DragTarget = { element: SVGGraphicsElement; original: Matrix };

type DragState = {
  mode: "move" | "duplicate";
  count: number;
};

type ActiveDrag = DragState & {
  targets: DragTarget[];
  startClient: StagePoint;
  moved: boolean;
  toggleOnClick: string | null;
};

type ActiveTransform = {
  mode: "scale" | "rotate";
  direction: string | null;
  element: SVGGraphicsElement;
  start: StagePoint;
  startAngle: number;
  baseMatrix: Matrix;
  box: ImportBox;
  uniform: boolean;
  moved: boolean;
};

const create = <K extends keyof SVGElementTagNameMap>(tag: K) =>
  document.createElementNS(SVG_NS, tag);

/** DOM typings call the parent of SVG nodes HTMLElement — keep it an Element. */
const parentOf = (element: Element): Element | null =>
  element.parentNode instanceof Element ? element.parentNode : null;

const isInput = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
    (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable),
  );
};

export class Stage {
  readonly svg: SVGSVGElement;
  readonly docGroup: SVGGElement;
  readonly overlay: SVGGElement;
  readonly toolOverlay: SVGGElement;
  readonly history: HistoryStack;

  private zoom = 1;
  private tx = 0;
  private ty = 0;
  private panning = false;
  private panStart: (StagePoint & { clientX: number; clientY: number }) | null = null;
  private spaceDown = false;
  private selection = new Set<string>();
  private activeGroup: SVGGElement | null = null;
  private tool: Tool | null = null;
  private drag: ActiveDrag | null = null;
  private transform: ActiveTransform | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly observer: ResizeObserver;

  constructor(private readonly container: HTMLElement) {
    this.svg = create("svg");
    this.svg.setAttribute("class", "stage-svg");
    this.svg.setAttribute("xmlns", SVG_NS);

    this.docGroup = create("g");
    this.docGroup.id = DOC_GROUP_ID;
    this.overlay = create("g");
    this.overlay.id = OVERLAY_ID;
    this.overlay.setAttribute("pointer-events", "none");
    this.toolOverlay = create("g");
    this.toolOverlay.id = "tool-overlay";
    this.toolOverlay.setAttribute("pointer-events", "none");

    this.svg.append(this.docGroup, this.overlay, this.toolOverlay);
    container.append(this.svg);

    this.history = new HistoryStack(
      () => this.docGroup.innerHTML,
      (snapshot) => {
        this.docGroup.innerHTML = snapshot;
        this.selection.clear();
        this.activeGroup = this.resolveGroup(this.activeGroup?.id);
        this.emit();
      },
    );

    this.observer = new ResizeObserver(() => this.applyViewBox());
    this.observer.observe(container);

    this.svg.addEventListener("wheel", this.onWheel, { passive: false });
    this.svg.addEventListener("pointerdown", this.onPointerDown);
    this.svg.addEventListener("dblclick", this.onDoubleClick);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.applyViewBox();
  }

  destroy(): void {
    this.tool?.onDeactivate?.();
    this.observer.disconnect();
    this.svg.removeEventListener("wheel", this.onWheel);
    this.svg.removeEventListener("pointerdown", this.onPointerDown);
    this.svg.removeEventListener("dblclick", this.onDoubleClick);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.svg.remove();
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit() {
    this.renderOverlay();
    for (const callback of this.listeners) callback();
  }

  get zoomLevel() {
    return this.zoom;
  }

  getViewport(): StageViewport {
    return { zoom: this.zoom, tx: this.tx, ty: this.ty };
  }

  /** Lossless document body + viewport, suitable for local persistence. */
  snapshot(): StageSnapshot {
    return { svg: this.docGroup.innerHTML, viewport: this.getViewport() };
  }

  /** Restore a saved draft and reset the in-memory undo stack. */
  loadSnapshot(snapshot: { svg: string; viewport?: Partial<StageViewport> }): void {
    if (typeof snapshot.svg !== "string") throw new Error("Invalid document snapshot");
    this.tool?.onDeactivate?.();
    this.tool = null;
    this.docGroup.innerHTML = snapshot.svg;
    assignIds(this.docGroup);
    this.selection.clear();
    this.activeGroup = null;
    const viewport = snapshot.viewport;
    if (viewport) {
      const zoom = Number(viewport.zoom);
      const tx = Number(viewport.tx);
      const ty = Number(viewport.ty);
      if (Number.isFinite(zoom)) this.zoom = Math.min(64, Math.max(0.05, zoom));
      if (Number.isFinite(tx)) this.tx = tx;
      if (Number.isFinite(ty)) this.ty = ty;
    }
    this.svg.style.cursor = "";
    this.toolOverlay.replaceChildren();
    this.history.clear();
    this.applyViewBox();
    this.emit();
  }

  setTool(tool: Tool | null) {
    if (this.tool === tool) return;
    this.tool?.onDeactivate?.();
    this.tool = tool;
    this.svg.style.cursor = tool ? "crosshair" : "";
    this.tool?.onActivate?.(this);
    this.emit();
  }

  get activeToolId(): string | null {
    return this.tool?.id ?? null;
  }

  /** Live state for the canvas HUD while objects are being dragged. */
  get dragState(): DragState | null {
    return this.drag ? { mode: this.drag.mode, count: this.drag.count } : null;
  }

  // ---- coordinates -------------------------------------------------------

  /** Client (screen) coordinates -> document coordinates. */
  screenToDoc(clientX: number, clientY: number): StagePoint {
    const ctm = this.svg.getScreenCTM?.();
    if (ctm) {
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    }
    const rect = this.svg.getBoundingClientRect();
    return {
      x: this.tx + (clientX - rect.left) / this.zoom,
      y: this.ty + (clientY - rect.top) / this.zoom,
    };
  }

  /** Client coordinates in the active group's local space (for drawing). */
  screenToScope(clientX: number, clientY: number): StagePoint {
    const ctm = this.scopeRoot().getScreenCTM?.();
    if (ctm) {
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    }
    return this.screenToDoc(clientX, clientY);
  }

  /** Client point in a given parent's local coordinates (for moving objects). */
  private localPoint(parent: Element | null, clientX: number, clientY: number): StagePoint {
    const ctm = (parent as SVGGraphicsElement | null)?.getScreenCTM?.();
    if (ctm) {
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    }
    return this.screenToDoc(clientX, clientY);
  }

  /** Add a new document element in the current scope. */
  appendToScope(element: Element) {
    this.scopeRoot().append(element);
  }

  private applyViewBox() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.svg.setAttribute(
      "viewBox",
      `${this.tx} ${this.ty} ${width / this.zoom} ${height / this.zoom}`,
    );
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
  }

  private setZoom(next: number, anchorClient?: StagePoint) {
    const clamped = Math.min(64, Math.max(0.05, next));
    if (anchorClient) {
      const before = this.screenToDoc(anchorClient.x, anchorClient.y);
      this.zoom = clamped;
      this.applyViewBox();
      const after = this.screenToDoc(anchorClient.x, anchorClient.y);
      this.tx += before.x - after.x;
      this.ty += before.y - after.y;
    } else {
      this.zoom = clamped;
    }
    this.applyViewBox();
    this.emit();
  }

  fitToDocument() {
    try {
      const box = this.docGroup.getBBox();
      if (!box.width || !box.height) return;
      const rect = this.container.getBoundingClientRect();
      const zoom = Math.min((rect.width - 64) / box.width, (rect.height - 64) / box.height);
      this.zoom = Math.min(64, Math.max(0.05, zoom));
      this.tx = box.x + box.width / 2 - rect.width / this.zoom / 2;
      this.ty = box.y + box.height / 2 - rect.height / this.zoom / 2;
      this.applyViewBox();
      this.emit();
    } catch {
      // getBBox unsupported — leave the view as is.
    }
  }

  /** Bounding box of one element, expressed in SVG (viewport) coordinates. */
  elementBox(element: Element): ImportBox | null {
    return this.bboxInSvgSpace(element);
  }

  /** Combined document-space box of the selection (null when empty). */
  selectionBox(): ImportBox | null {
    const boxes = this.selectedElements()
      .map((element) => this.bboxInSvgSpace(element))
      .filter((box): box is ImportBox => Boolean(box));
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map((box) => box.x));
    const y = Math.min(...boxes.map((box) => box.y));
    return {
      x,
      y,
      width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
      height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
    };
  }

  /** Centre the view on the selection, or on all content when nothing is selected. */
  recenter(): void {
    const box =
      this.selectionBox() ??
      safeBBox(this.docGroup, {
        x: this.tx,
        y: this.ty,
        width: this.container.clientWidth || 1,
        height: this.container.clientHeight || 1,
      });
    if (!box.width || !box.height) return;
    this.tx = box.x + box.width / 2 - (this.container.clientWidth || 1) / this.zoom / 2;
    this.ty = box.y + box.height / 2 - (this.container.clientHeight || 1) / this.zoom / 2;
    this.applyViewBox();
    this.emit();
  }

  // ---- document operations ----------------------------------------------

  /** Call before any mutation so it can be undone. */
  checkpoint() {
    this.history.checkpoint();
    this.emit();
  }

  undo() {
    if (this.history.undo()) this.emit();
  }

  redo() {
    if (this.history.redo()) this.emit();
  }

  get canUndo() {
    return this.history.canUndo;
  }

  get canRedo() {
    return this.history.canRedo;
  }

  importSvg(text: string, name: string): SVGGElement {
    this.checkpoint();
    const parsed = parseSvg(text);
    const count = this.docGroup.children.length;
    const group = importIntoDocument(parsed, name, this.docGroup, {
      placeAt: { x: 40 + (count % 5) * 32, y: 40 + (count % 5) * 32 },
    });
    this.select(group.id);
    return group;
  }

  exportSvg(padding = 8): string {
    return serializeDocument(this.docGroup, { padding });
  }

  exportPng(pixelRatio = 2): string | null {
    try {
      const clone = this.svg.cloneNode(true) as SVGSVGElement;
      clone.querySelector(`#${OVERLAY_ID}`)?.remove();
      const box = this.docGroup.getBBox();
      if (!box.width || !box.height) return null;
      const padding = 8;
      clone.setAttribute(
        "viewBox",
        `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${
          box.height + padding * 2
        }`,
      );
      const serialized = new XMLSerializer().serializeToString(clone);
      const img = new window.Image();
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(serialized)))}`;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil((box.width + padding * 2) * pixelRatio);
      canvas.height = Math.ceil((box.height + padding * 2) * pixelRatio);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  downloadSvg(name: string, padding = 8) {
    downloadText(`${name || "compose"}.svg`, this.exportSvg(padding), "image/svg+xml");
  }

  // ---- selection ---------------------------------------------------------

  get selectedIds(): string[] {
    return [...this.selection];
  }

  get enteredGroupId(): string | null {
    return this.activeGroup?.id ?? null;
  }

  private resolveGroup(id?: string): SVGGElement | null {
    if (!id) return null;
    const element = this.docGroup.querySelector(`[id="${id}"]`);
    return element && this.docGroup.contains(element) && element.tagName.toLowerCase() === "g"
      ? (element as SVGGElement)
      : null;
  }

  private elementFor(id: string): SVGGraphicsElement | null {
    const element = this.docGroup.querySelector(`[id="${id}"]`);
    return element instanceof Element ? (element as SVGGraphicsElement) : null;
  }

  private scopeRoot(): SVGGElement {
    return this.activeGroup ?? this.docGroup;
  }

  private isSelectable(element: Element): boolean {
    return (
      element !== this.docGroup &&
      this.docGroup.contains(element) &&
      element.getAttribute("display") !== "none" &&
      element.getAttribute("data-locked") !== "true"
    );
  }

  /**
   * Resolve a click target into the element that should be selected.
   * Normal clicks pick the top-level item in the current scope; Ctrl+click
   * picks the concrete element that was hit, even inside a group.
   */
  private selectableFrom(target: EventTarget | null, deep = false): SVGGraphicsElement | null {
    let element = target instanceof Element ? target : null;
    const scope = this.scopeRoot();
    if (!element || element === scope || !this.isSelectable(element)) return null;

    if (deep) {
      while (element && element !== scope && !element.id) element = parentOf(element);
      return element && element !== scope && this.isSelectable(element)
        ? (element as SVGGraphicsElement)
        : null;
    }

    while (element && parentOf(element) && parentOf(element) !== scope) {
      if (element === scope) return null;
      element = parentOf(element);
    }
    return element && parentOf(element) === scope && this.isSelectable(element)
      ? (element as SVGGraphicsElement)
      : null;
  }

  select(id: string | null, options: { additive?: boolean } = {}): void {
    if (!id) {
      this.selection.clear();
    } else if (options.additive) {
      if (this.selection.has(id)) this.selection.delete(id);
      else this.selection.add(id);
    } else {
      this.selection = new Set([id]);
    }
    this.emit();
  }

  clearSelection(): void {
    this.selection.clear();
    this.emit();
  }

  enterGroup(id: string): void {
    const group = this.resolveGroup(id);
    if (!group || group.tagName.toLowerCase() !== "g") return;
    this.activeGroup = group;
    const first = Array.from(group.children).find((child) => this.isSelectable(child));
    this.selection = new Set(first ? [first.id] : []);
    this.emit();
  }

  exitGroup(): void {
    if (!this.activeGroup) return;
    const id = this.activeGroup.id;
    const parent = parentOf(this.activeGroup);
    this.activeGroup = parent && parent !== this.docGroup ? (parent as SVGGElement) : null;
    this.selection = new Set([id]);
    this.emit();
  }

  selectedElements(): SVGGraphicsElement[] {
    return this.selectedIds
      .map((id) => this.elementFor(id))
      .filter((element): element is SVGGraphicsElement => Boolean(element));
  }

  deleteSelection(): void {
    const elements = this.selectedElements();
    if (!elements.length) return;
    this.checkpoint();
    for (const element of elements) element.remove();
    if (this.activeGroup && !this.docGroup.contains(this.activeGroup)) this.activeGroup = null;
    this.selection.clear();
    this.emit();
  }

  /** Delete a specific layer by id (used by the layers panel). */
  deleteById(id: string): void {
    const element = this.elementFor(id);
    if (!element) return;
    this.checkpoint();
    element.remove();
    if (this.activeGroup && !this.docGroup.contains(this.activeGroup)) this.activeGroup = null;
    this.selection.delete(id);
    this.emit();
  }

  /** Duplicate a specific layer by id and select the copy. */
  duplicateById(id: string): void {
    const element = this.elementFor(id);
    if (!element) return;
    this.checkpoint();
    const clone = element.cloneNode(true) as SVGGraphicsElement;
    regenerateIds(clone);
    parentOf(element)?.insertBefore(clone, element.nextSibling);
    this.selection = new Set([clone.id]);
    this.emit();
  }

  duplicateSelection(): void {
    const elements = this.selectedElements();
    if (!elements.length) return;
    this.checkpoint();
    const clones: SVGGraphicsElement[] = [];
    for (const element of elements) {
      const clone = element.cloneNode(true) as SVGGraphicsElement;
      regenerateIds(clone);
      parentOf(element)?.insertBefore(clone, element.nextSibling);
      clones.push(clone);
    }
    this.selection = new Set(clones.map((clone) => clone.id));
    this.emit();
  }

  /** Read the first selected element's presentation attributes for the inspector. */
  getSelectionStyle(): SelectionStyle | null {
    const elements = this.selectedElements();
    const selected = elements[0];
    if (!selected) return null;
    const element =
      selected.tagName.toLowerCase() === "g"
        ? (selected.querySelector("rect, circle, ellipse, path, line, polygon, polyline, text") ??
          selected)
        : selected;
    const tag = element.tagName.toLowerCase();
    const matrix = parseTransform(selected.getAttribute("transform"));
    return {
      tag,
      fill: toHexColor(element.getAttribute("fill"), tag === "text" ? "#1f2937" : "#a5b4fc"),
      stroke: toHexColor(element.getAttribute("stroke"), "#312e81"),
      strokeWidth: Number(element.getAttribute("stroke-width") ?? 2) || 2,
      text: tag === "text" ? (element.textContent ?? "") : null,
      fontSize: Number(element.getAttribute("font-size") ?? 24) || 24,
      radius: tag === "rect" ? Number(element.getAttribute("rx") ?? 0) || 0 : null,
      rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
      count: elements.length,
    };
  }

  /** Apply presentation changes to the selection (groups apply to descendants). */
  setStyle(patch: StylePatch): void {
    const elements = this.selectedElements();
    if (!elements.length) return;
    this.checkpoint();
    const targets = elements.flatMap((element) =>
      element.tagName.toLowerCase() === "g" ? Array.from(element.querySelectorAll("*")) : [element],
    );
    for (const element of targets) {
      if (patch.fill !== undefined) element.setAttribute("fill", patch.fill);
      if (patch.stroke !== undefined) element.setAttribute("stroke", patch.stroke);
      if (patch.strokeWidth !== undefined) {
        element.setAttribute("stroke-width", String(patch.strokeWidth));
      }
      if (patch.fontSize !== undefined && element.tagName.toLowerCase() === "text") {
        element.setAttribute("font-size", String(patch.fontSize));
      }
    }
    if (patch.text !== undefined) {
      for (const element of elements) {
        if (element.tagName.toLowerCase() === "text") element.textContent = patch.text;
      }
    }
    this.emit();
  }

  /** Rounded corners, applied without a checkpoint (tools checkpoint once). */
  applyCornerRadius(radius: number): void {
    const targets: Element[] = [];
    for (const element of this.selectedElements()) {
      const tag = element.tagName.toLowerCase();
      if (tag === "g") targets.push(...Array.from(element.querySelectorAll("rect, path")));
      else if (tag === "rect" || tag === "path") targets.push(element);
    }
    const value = Math.max(0, radius);
    for (const target of targets) {
      if (target.tagName.toLowerCase() === "rect") {
        target.setAttribute("rx", String(value));
        target.setAttribute("ry", String(value));
        continue;
      }
      // A 4-node path (Object to Path) is rounded by scaling its bezier
      // handles — the same geometry a smooth node toggle produces.
      const model = pathToModel(target.getAttribute("d"));
      if (!model || model.nodes.length !== 4) continue;
      const box = this.bboxInSvgSpace(target);
      const half = Math.min(box?.width ?? 100, box?.height ?? 100) / 2 || 1;
      const amount = Math.max(0, Math.min(1, value / half));
      for (let index = 0; index < model.nodes.length; index += 1) makeCorner(model, index);
      if (amount > 0) {
        for (let index = 0; index < model.nodes.length; index += 1) makeSmooth(model, index);
        for (const node of model.nodes) {
          if (node.in) node.in = { x: node.in.x * amount, y: node.in.y * amount };
          if (node.out) node.out = { x: node.out.x * amount, y: node.out.y * amount };
        }
      }
      target.setAttribute("d", modelToPath(model));
      target.setAttribute("data-corner", String(amount));
    }
    this.emit();
  }

  setCornerRadius(radius: number): void {
    if (!this.selectedElements().length) return;
    this.checkpoint();
    this.applyCornerRadius(radius);
  }

  /** Scale the transform handle's target around a fixed anchor point. */
  private applyScale(sx: number, sy: number, anchor: StagePoint): void {
    const handle = this.transform;
    if (!handle) return;
    const around = multiply(
      multiply(translate(anchor.x, anchor.y), scale(sx, sy)),
      translate(-anchor.x, -anchor.y),
    );
    setTransform(handle.element, multiply(around, handle.baseMatrix));
    this.emit();
  }

  /** Rotate around each object's own centre, keeping it in place. */
  applyRotation(degrees: number, baseMatrix?: Matrix): void {
    for (const element of this.selectedElements()) {
      const box = this.bboxInSvgSpace(element);
      const local = (element as SVGGraphicsElement).getBBox?.();
      const cx =
        local && Number.isFinite(local.x)
          ? local.x + local.width / 2
          : (box?.x ?? 0) + (box?.width ?? 0) / 2;
      const cy =
        local && Number.isFinite(local.y)
          ? local.y + local.height / 2
          : (box?.y ?? 0) + (box?.height ?? 0) / 2;
      const matrix = baseMatrix ?? parseTransform(element.getAttribute("transform"));
      const current = (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI;
      const delta = ((degrees - current + 540) % 360) - 180;
      const aroundCenter = multiply(
        multiply(translate(cx, cy), rotate(delta)),
        translate(-cx, -cy),
      );
      setTransform(element, multiply(matrix, aroundCenter));
      element.setAttribute("data-rotation", String(degrees));
    }
    this.emit();
  }

  setRotation(degrees: number): void {
    if (!this.selectedElements().length) return;
    this.checkpoint();
    this.applyRotation(degrees);
  }

  /** Convert selected basic shapes to paths without changing their appearance. */
  convertSelectionToPath(): void {
    const isConvertible = (element: Element) =>
      element.tagName.toLowerCase() !== "path" && shapeToPathData(element) !== null;
    const targets = this.selectedElements().flatMap((element) => {
      if (element.tagName.toLowerCase() === "g") {
        return Array.from(element.querySelectorAll("*")).filter(isConvertible);
      }
      return isConvertible(element) ? [element] : [];
    });
    if (!targets.length) return;

    this.checkpoint();
    for (const element of targets) {
      const path = create("path");
      path.setAttribute("d", shapeToPathData(element)!);
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name !== "d") path.setAttribute(attribute.name, attribute.value);
      }
      element.parentElement?.replaceChild(path, element);
    }
    this.selection = new Set(targets.map((element) => element.id));
    this.emit();
  }

  toggleVisibility(id: string): void {
    const element = this.elementFor(id);
    if (!element) return;
    this.checkpoint();
    const hidden = element.getAttribute("display") === "none";
    if (hidden) element.removeAttribute("display");
    else element.setAttribute("display", "none");
    if (!hidden) this.selection.delete(id);
    this.emit();
  }

  reorder(direction: "front" | "back" | "up" | "down"): void {
    const elements = this.selectedElements();
    if (!elements.length) return;
    this.checkpoint();
    for (const element of elements) {
      const parent = parentOf(element);
      if (!parent || parent === this.svg) continue;
      if (direction === "front") parent.append(element);
      else if (direction === "back") parent.insertBefore(element, parent.firstChild);
      else if (direction === "up" && element.nextElementSibling) {
        parent.insertBefore(element.nextElementSibling, element);
      } else if (direction === "down" && element.previousElementSibling) {
        parent.insertBefore(element, element.previousElementSibling);
      }
    }
    this.emit();
  }

  /**
   * Wrap the selection in a new group. Mixed parents are allowed: each
   * object's ancestor transforms are baked in first, so nothing moves on
   * screen and even a shape pulled out of a group can be grouped with it.
   */
  groupSelection(): void {
    const elements = this.selectedElements();
    if (elements.length < 2) return;

    this.checkpoint();
    const group = create("g");
    group.id = nextId();
    this.docGroup.append(group);
    for (const element of elements) {
      let matrix = IDENTITY;
      let ancestor = parentOf(element);
      while (ancestor && ancestor !== this.docGroup) {
        matrix = multiply(parseTransform(ancestor.getAttribute("transform")), matrix);
        ancestor = parentOf(ancestor);
      }
      bakeInto(element, matrix);
      group.append(element);
    }
    this.selection = new Set([group.id]);
    this.emit();
  }

  /** Lift children out of the selected groups, baking each group's transform. */
  ungroupSelection(): void {
    const groups = this.selectedElements().filter(
      (element) => element.tagName.toLowerCase() === "g",
    );
    if (!groups.length) return;

    this.checkpoint();
    const lifted: Element[] = [];
    for (const group of groups) {
      const parent = parentOf(group);
      if (!parent) continue;
      const matrix = parseTransform(group.getAttribute("transform"));
      for (const child of Array.from(group.children)) {
        bakeInto(child, matrix);
        parent.insertBefore(child, group);
        lifted.push(child);
      }
      group.remove();
    }
    this.selection = new Set(lifted.map((child) => child.id));
    this.emit();
  }

  /** Pull selected objects out of their group(s) into the document root. */
  detachSelection(): void {
    const elements = this.selectedElements().filter(
      (element) => parentOf(element) !== this.docGroup,
    );
    if (!elements.length) return;

    this.checkpoint();
    for (const element of elements) {
      let matrix = IDENTITY;
      let ancestor = parentOf(element);
      while (ancestor && ancestor !== this.docGroup) {
        matrix = multiply(parseTransform(ancestor.getAttribute("transform")), matrix);
        ancestor = parentOf(ancestor);
      }
      bakeInto(element, matrix);
      this.docGroup.append(element);
    }
    this.emit();
  }

  /** Align selected objects relative to the first selected one. */
  align(direction: "left" | "center" | "right" | "top" | "middle" | "bottom"): void {
    const elements = this.selectedElements();
    if (!elements.length) return;
    const boxes = elements.map((element) => this.bboxInSvgSpace(element));
    const reference = boxes[0];
    if (!reference) return;

    this.checkpoint();
    elements.forEach((element, index) => {
      const box = boxes[index];
      if (!box) return;
      let dx = 0;
      let dy = 0;
      if (direction === "left") dx = reference.x - box.x;
      if (direction === "center") dx = reference.x + reference.width / 2 - (box.x + box.width / 2);
      if (direction === "right") dx = reference.x + reference.width - (box.x + box.width);
      if (direction === "top") dy = reference.y - box.y;
      if (direction === "middle")
        dy = reference.y + reference.height / 2 - (box.y + box.height / 2);
      if (direction === "bottom") dy = reference.y + reference.height - (box.y + box.height);
      bakeInto(element, translate(dx, dy));
    });
    this.emit();
  }

  /** Tree used by the React Layers panel (never rendered into the canvas). */
  getTree(): LayerNode[] {
    const walk = (parent: Element): LayerNode[] =>
      Array.from(parent.children).map((element) => ({
        id: element.id,
        tag: element.tagName.toLowerCase(),
        label:
          element.getAttribute("data-name") ??
          (element.tagName.toLowerCase() === "g" ? "Group" : element.tagName.toUpperCase()),
        hidden: element.getAttribute("display") === "none",
        locked: element.getAttribute("data-locked") === "true",
        children: walk(element),
      }));
    return walk(this.docGroup);
  }

  // ---- overlay -----------------------------------------------------------

  private bboxInSvgSpace(element: Element): ImportBox | null {
    try {
      const box = (element as SVGGraphicsElement).getBBox?.();
      if (!box || (!box.width && !box.height)) return null;
      const svgCtm = this.svg.getScreenCTM?.();
      const elementCtm = (element as SVGGraphicsElement).getScreenCTM?.();
      if (!svgCtm || !elementCtm || typeof DOMPoint === "undefined") {
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }
      const matrix = svgCtm.inverse().multiply(elementCtm);
      const points = [
        new DOMPoint(box.x, box.y),
        new DOMPoint(box.x + box.width, box.y),
        new DOMPoint(box.x + box.width, box.y + box.height),
        new DOMPoint(box.x, box.y + box.height),
      ].map((point) => point.matrixTransform(matrix));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    } catch {
      return null;
    }
  }

  private overlayRect(box: ImportBox, className: string): SVGRectElement {
    const rect = create("rect");
    rect.setAttribute("class", className);
    rect.setAttribute("x", String(box.x));
    rect.setAttribute("y", String(box.y));
    rect.setAttribute("width", String(box.width));
    rect.setAttribute("height", String(box.height));
    return rect;
  }

  private renderOverlay(): void {
    this.overlay.replaceChildren();
    if (this.activeGroup && this.activeGroup !== this.docGroup) {
      const box = this.bboxInSvgSpace(this.activeGroup);
      if (box) this.overlay.append(this.overlayRect(box, "overlay-group"));
    }
    const radius = 4 / this.zoom;
    const selected = this.selectedElements();
    for (const element of selected) {
      const box = this.bboxInSvgSpace(element);
      if (box) this.overlay.append(this.overlayRect(box, "overlay-selection"));
    }

    // Transform tools draw their own handles; the generic boxes would compete.
    if (this.tool || selected.length !== 1) return;
    const element = selected[0]!;
    const box = this.bboxInSvgSpace(element);
    if (!box) return;

    const corners = [
      { direction: "nw", x: box.x, y: box.y },
      { direction: "ne", x: box.x + box.width, y: box.y },
      { direction: "se", x: box.x + box.width, y: box.y + box.height },
      { direction: "sw", x: box.x, y: box.y + box.height },
    ];
    for (const corner of corners) {
      const handle = create("circle");
      handle.setAttribute("class", "overlay-handle");
      handle.setAttribute("cx", String(corner.x));
      handle.setAttribute("cy", String(corner.y));
      handle.setAttribute("r", String(radius));
      handle.setAttribute("data-transform", "scale");
      handle.setAttribute("data-direction", corner.direction);
      handle.setAttribute("data-target", element.id);
      this.overlay.append(handle);
    }

    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const top = {
      x: centre.x,
      y: centre.y - Math.max(box.width, box.height) / 2 - 40 / this.zoom,
    };
    const stem = create("line");
    stem.setAttribute("class", "overlay-rotate-line");
    stem.setAttribute("x1", String(centre.x));
    stem.setAttribute("y1", String(box.y));
    stem.setAttribute("x2", String(top.x));
    stem.setAttribute("y2", String(top.y));
    this.overlay.append(stem);

    const rotate = create("circle");
    rotate.setAttribute("class", "overlay-rotate");
    rotate.setAttribute("cx", String(top.x));
    rotate.setAttribute("cy", String(top.y));
    rotate.setAttribute("r", String(radius * 1.2));
    rotate.setAttribute("data-transform", "rotate");
    rotate.setAttribute("data-target", element.id);
    this.overlay.append(rotate);
  }

  // ---- pointer / keyboard ------------------------------------------------

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
      this.tx += event.deltaY / this.zoom;
      this.applyViewBox();
      this.emit();
      return;
    }
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.setZoom(this.zoom * factor, { x: event.clientX, y: event.clientY });
  };

  private underPointer(event: PointerEvent, skipSelected: boolean): SVGGraphicsElement | null {
    if (skipSelected && document.elementsFromPoint) {
      for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
        const selectable = this.selectableFrom(element, event.ctrlKey || event.metaKey);
        if (selectable && !this.selection.has(selectable.id)) return selectable;
      }
      return null;
    }
    return this.selectableFrom(event.target, event.ctrlKey || event.metaKey);
  }

  private beginTransform(event: PointerEvent): boolean {
    const target = event.target as Element | null;
    const mode = target?.getAttribute("data-transform");
    if (!mode || (mode !== "scale" && mode !== "rotate")) return false;
    const element = this.elementFor(target!.getAttribute("data-target") ?? "");
    const box = element && this.bboxInSvgSpace(element);
    if (!element || !box) return false;
    const start = this.screenToDoc(event.clientX, event.clientY);
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    this.transform = {
      mode,
      direction: target!.getAttribute("data-direction"),
      element,
      start,
      startAngle: Math.atan2(start.y - centre.y, start.x - centre.x),
      baseMatrix: parseTransform(element.getAttribute("transform")),
      box,
      uniform: event.shiftKey,
      moved: false,
    };
    try {
      this.svg.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events have no active pointer to capture.
    }
    return true;
  }

  private updateTransform(event: PointerEvent) {
    const handle = this.transform;
    if (!handle) return;
    const point = this.screenToDoc(event.clientX, event.clientY);
    if (!handle.moved && Math.hypot(point.x - handle.start.x, point.y - handle.start.y) < 2) return;
    if (!handle.moved) {
      handle.moved = true;
      this.checkpoint();
    }

    if (handle.mode === "rotate") {
      const centre = {
        x: handle.box.x + handle.box.width / 2,
        y: handle.box.y + handle.box.height / 2,
      };
      const angle = Math.atan2(point.y - centre.y, point.x - centre.x);
      const delta = (angle - handle.startAngle) * (180 / Math.PI);
      const current = (Math.atan2(handle.baseMatrix[1], handle.baseMatrix[0]) * 180) / Math.PI;
      this.applyRotation(current + delta, handle.baseMatrix);
      return;
    }

    const { x, y, width, height } = handle.box;
    let anchor: StagePoint;
    let sx: number;
    let sy: number;
    switch (handle.direction) {
      case "nw":
        anchor = { x: x + width, y: y + height };
        sx = (anchor.x - point.x) / (width || 1);
        sy = (anchor.y - point.y) / (height || 1);
        break;
      case "ne":
        anchor = { x, y: y + height };
        sx = (point.x - anchor.x) / (width || 1);
        sy = (anchor.y - point.y) / (height || 1);
        break;
      case "sw":
        anchor = { x: x + width, y };
        sx = (anchor.x - point.x) / (width || 1);
        sy = (point.y - anchor.y) / (height || 1);
        break;
      default:
        anchor = { x, y };
        sx = (point.x - anchor.x) / (width || 1);
        sy = (point.y - anchor.y) / (height || 1);
    }
    sx = Math.max(0.05, sx);
    sy = Math.max(0.05, handle.uniform ? sx : sy);
    this.applyScale(sx, sy, anchor);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.spaceDown || event.button === 1) {
      event.preventDefault();
      this.panning = true;
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      try {
        this.svg.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic events have no active pointer to capture.
      }
      return;
    }
    if (event.button !== 0) return;
    if (this.beginTransform(event)) return;
    if (this.tool) {
      const target = event.target as Element | null;
      const ownHandle = target?.getAttribute("data-manipulator") === this.tool.id;
      if (!this.tool.manipulatorOnly || ownHandle) {
        const context: ToolContext = { stage: this, event };
        this.tool.onPointerDown?.(context);
        return;
      }
      // Handle-only tools let a click elsewhere select another object.
    }
    const hit = this.underPointer(event, event.altKey);
    if (!hit) {
      this.select(null);
      return;
    }
    const toggleOnClick = event.shiftKey && this.selection.has(hit.id) ? hit.id : null;
    if (!this.selection.has(hit.id)) this.select(hit.id, { additive: event.shiftKey });
    const targets = this.selectedElements().map((element) => ({
      element,
      original: parseTransform(element.getAttribute("transform")),
    }));
    if (!targets.length) return;
    this.drag = {
      mode: event.ctrlKey || event.metaKey ? "duplicate" : "move",
      count: targets.length,
      targets,
      startClient: { x: event.clientX, y: event.clientY },
      moved: false,
      toggleOnClick,
    };
  };

  private onDoubleClick = (event: MouseEvent) => {
    const hit = this.selectableFrom(event.target);
    if (hit && hit.tagName.toLowerCase() === "g") this.enterGroup(hit.id);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.transform) {
      this.updateTransform(event);
      return;
    }
    if (this.drag) {
      const drag = this.drag;
      const distance = Math.hypot(
        event.clientX - drag.startClient.x,
        event.clientY - drag.startClient.y,
      );
      if (!drag.moved && distance <= 3) return;
      if (!drag.moved) {
        drag.moved = true;
        this.checkpoint();
        if (drag.mode === "duplicate") {
          const clones: DragTarget[] = [];
          for (const target of drag.targets) {
            const clone = target.element.cloneNode(true) as SVGGraphicsElement;
            regenerateIds(clone);
            parentOf(target.element)?.insertBefore(clone, target.element.nextSibling);
            clones.push({
              element: clone,
              original: parseTransform(clone.getAttribute("transform")),
            });
          }
          drag.targets = clones;
          this.selection = new Set(clones.map((clone) => clone.element.id));
        }
      }
      for (const target of drag.targets) {
        const parent = parentOf(target.element);
        const start = this.localPoint(parent, drag.startClient.x, drag.startClient.y);
        const current = this.localPoint(parent, event.clientX, event.clientY);
        setTransform(
          target.element,
          multiply(translate(current.x - start.x, current.y - start.y), target.original),
        );
      }
      this.emit();
      return;
    }
    if (!this.panning || !this.panStart) {
      if (this.tool) this.tool.onPointerMove?.({ stage: this, event });
      return;
    }
    const dx = (event.clientX - this.panStart.clientX) / this.zoom;
    const dy = (event.clientY - this.panStart.clientY) / this.zoom;
    this.tx -= dx;
    this.ty -= dy;
    this.panStart = { ...this.panStart, clientX: event.clientX, clientY: event.clientY };
    this.applyViewBox();
    this.emit();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.transform) {
      this.transform = null;
      try {
        this.svg.releasePointerCapture?.(event.pointerId);
      } catch {
        // No active pointer (synthetic event).
      }
      this.emit();
    }
    if (this.drag) {
      const { toggleOnClick, moved } = this.drag;
      this.drag = null;
      if (!moved && toggleOnClick) this.select(toggleOnClick, { additive: true });
      else this.emit();
    }
    if (this.tool) this.tool.onPointerUp?.({ stage: this, event });
    if (!this.panning) return;
    this.panning = false;
    this.panStart = null;
    try {
      this.svg.releasePointerCapture?.(event.pointerId);
    } catch {
      // No active pointer (synthetic event).
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Space" && !isInput(event.target) && !this.spaceDown) {
      this.spaceDown = true;
      this.svg.style.cursor = "grab";
      return;
    }
    if (isInput(event.target)) return;
    if (this.tool) this.tool.onKey?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      if (this.selection.size) this.clearSelection();
      else this.exitGroup();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.deleteSelection();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      this.spaceDown = false;
      this.svg.style.cursor = "";
    }
  };
}
